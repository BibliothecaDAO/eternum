"""Back up one shard and prove the copy restores.

    sudo python3 backup.py quiesce PROJECT [RELAY_HEALTH_URL]
    sudo python3 backup.py reopen PROJECT
    sudo python3 backup.py capture PROJECT DATA_DIR DEST
    sudo python3 backup.py restore-test PROJECT DEST
    sudo python3 backup.py verify PROJECT DEST

PROJECT is the shard's compose project and DATA_DIR its private data directory (the package's SHARD_DATA). Capture
writes DEST once: Herald's Postgres hot (a base backup plus a dump), the chain as a cold copy of the node's volume
taken while the node is stopped, the private VRF key, the data directory, the images every service runs and
checksums of all of it, then `capture.json`. The node is down only while its volume is copied; capture.json records
how long. Restore-test brings the copy up in scratch containers without a network, compares the restored chain's
block at the captured head with the running node's, restores both Postgres copies, and writes
`restore-test/result.json`; it exits non-zero unless everything matches.

A final copy, the one a production teardown removes the shard after, is taken at a write boundary. The shard's RPC
proxy is its one write path (the node publishes no port) and also the path the value relay reads receipts through.
Quiesce makes the proxy refuse every write while it keeps answering reads (read-rpc.ts WRITES_CLOSED_FILE, in its public
configuration), so outstanding withdrawals are still found and paid; reopen lifts it. A shard deployed before that
switch can only close by stopping its proxy, which stops the relay's reads and payments too, so quiesce stops it only
once the relay has read every transaction: its health (the environment's /api/value/health) shows this shard read
through block N, caught up, with nothing deferred or held, and the stopped node holds no transaction after N. That
proves every obligation is in the relay's queue, not that the queue is paid: the health doesn't show it. The closure
file records how writes closed and N; an unfinished stop is recorded as such and never counts as closed. Verify then asks: the
copy's checksums hold, its restore test passed, it is of the running chain (the node still has the captured head),
writes are closed now, no block after the captured head holds a transaction, and none after the relay's last read
either. Blocks keep coming (the node seals empty ones), but none of them changed the game.
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from stack_lock import LOCK, isolated_stack_lock

POSTGRES_USER = "herald"
DATABASE = "herald"
STOP_GRACE_SECONDS = 60
# Blocks read per RPC batch when counting what the node accepted after a capture.
BLOCKS_PER_BATCH = 100
# One line per user table, `schema.table|rows`, exact rather than estimated.
COUNTS_SQL = """SELECT format('SELECT %L || ''|'' || count(*) FROM %I.%I;', schemaname || '.' || relname, schemaname,
relname) FROM pg_stat_user_tables ORDER BY schemaname, relname
\\gexec
"""


def capture(project, data, dest):
    dest.mkdir(mode=0o700, parents=True)
    record = {"project": project, "started": utc_now(), "images": service_images(project)}
    record["postgres"] = capture_postgres(project, dest)
    record["chain"] = capture_chain(project, dest)
    record["files"] = capture_files(project, data, dest)
    write_checksums(dest)
    record["finished"] = utc_now()
    write_json(dest / "capture.json", record)
    return record


def restore_test(project, dest):
    record = json.loads((dest / "capture.json").read_text())
    verify_checksums(dest)
    scratch = dest / "restore-test"
    scratch.mkdir(mode=0o700, exist_ok=True)
    result = {"project": project, "capture": record["started"]}
    result["chain"] = restore_chain(project, record, dest, scratch)
    result["postgres"] = restore_postgres(record, dest, scratch)
    result["passed"] = result["chain"]["matches"] and result["postgres"]["complete"]
    write_json(scratch / "result.json", result)
    return result


# Capture


# read-rpc.ts: the file the proxy looks for in its /config volume, and the refusal it then answers every write with.
WRITES_CLOSED_FILE = "writes-closed"
WRITES_CLOSED_MESSAGE = "Shard writes are closed for its final backup"


def quiesce(project, relay_health=None):
    """Closes the shard's writes, and is safe to run again. A proxy with the switch refuses them and keeps serving
    reads. A proxy without it is stopped once the relay has read every transaction; the closure records the relay's
    last read, first as stopping, then, after the stopped node shows nothing past it, as stopped."""
    record = closure_record(project)
    if record and record["by"] in (STOPPING, STOPPED) and proxy_state(project) == "stopped":
        return finish_stop(project, record["relay_through"])
    write_closure(project, {"by": SWITCH})
    if proxy_refuses_writes(project):
        return {"project": project, "writes": "closed", "by": SWITCH}
    # No switch: the proxy ignores the file, and it must not stand for a closure.
    clear_closure(project)
    if proxy_state(project) != "running":
        raise RuntimeError("The proxy neither refuses writes nor runs, so the relay can't be shown to have read the "
                           "shard; start it with reopen, then quiesce again")
    if not relay_health:
        raise RuntimeError("This shard's proxy has no write switch, and stopping it stops the relay's reads: name the "
                           "relay's health URL so it stops only once the relay has read every transaction")
    through = relay_read_through(relay_health, node_rpc(f"{project}-madara-1", "starknet_chainId", []))
    write_closure(project, {"by": STOPPING, "relay_through": through})
    stopped = docker(["stop", "-t", "10", f"{project}-rpc-1"], check=False)
    if stopped.returncode != 0:
        restore_reads(project)
        raise RuntimeError(f"The proxy did not stop ({stopped.stderr.strip()}); it serves reads and writes as before")
    return finish_stop(project, through)


def finish_stop(project, through):
    """With the proxy stopped: the node holds no transaction after the relay's last read, and the closure becomes
    stopped. Otherwise, or if that can't be counted, the relay's read path comes back and the closure goes."""
    node = f"{project}-madara-1"
    try:
        unread = transactions_between(node, through + 1, node_rpc(node, "starknet_blockNumber", []))
    except Exception:
        restore_reads(project)
        raise
    if unread:
        restore_reads(project)
        raise RuntimeError(f"{unread} transactions came after block {through}, the relay's last read; the proxy runs "
                           "again: let the relay read them, then quiesce again")
    write_closure(project, {"by": STOPPED, "relay_through": through})
    return {"project": project, "writes": "closed", "by": STOPPED, "relay_through": through}


def restore_reads(project):
    """Starts the stopped proxy again, then drops the unfinished closure. If it won't start, the stopping closure
    stays: writes are still closed, and quiesce or reopen continues from it."""
    started = docker(["start", f"{project}-rpc-1"], check=False)
    if started.returncode != 0:
        raise RuntimeError(f"The proxy is stopped and did not start ({started.stderr.strip()}); the closure stays "
                           "stopping: run quiesce to finish it or reopen to start the proxy")
    clear_closure(project)


def reopen(project):
    """Lifts quiesce: the proxy takes writes again, and any earlier final copy no longer verifies."""
    clear_closure(project)
    if proxy_state(project) == "stopped":
        started = docker(["start", f"{project}-rpc-1"], check=False)
        if started.returncode != 0:
            raise RuntimeError(f"The proxy did not start: {started.stderr.strip()}")
    return {"project": project, "writes": boundary_state(project)}


def relay_read_through(url, chain_id):
    """The last block of this shard the relay has read: every obligation up to it is stored in the relay's queue,
    since its cursor moves in the same write. Its health doesn't show that queue, so this proves the relay has read
    every transaction, not that it paid them: its last pass must still be caught up, with nothing deferred or held."""
    request = urllib.request.Request(url, headers={"User-Agent": "realms-backup/1"})
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            health = json.load(response)
    except urllib.error.HTTPError as error:
        # Unhealthy (503) still describes every shard; only the body matters here.
        with error:
            health = json.load(error)
    shard = next((row for row in health.get("shards", []) if int(row["chainId"], 16) == int(chain_id, 16)), None)
    if shard is None:
        raise RuntimeError("The relay does not serve this shard")
    value = shard.get("value") or {}
    if shard.get("halted") or shard.get("page") or value.get("status") != "ready" or value.get("more") is not False \
            or value.get("deferred") or health.get("held"):
        raise RuntimeError("The relay is not caught up on this shard: wait until its last pass is ready and complete, "
                           "with nothing deferred or held")
    return shard["nextBlock"] - 1


def writes_closed(project):
    """No write can reach the node: the proxy, asked now, refuses one as closed; or quiesce finished stopping it and
    Docker says it is stopped. A marker alone, an unfinished stop or an unanswered question proves nothing."""
    record = closure_record(project)
    if record is None:
        return False
    if record["by"] == SWITCH:
        return proxy_refuses_writes(project)
    return record["by"] == STOPPED and proxy_state(project) == "stopped"


def boundary_state(project):
    """closed, open, stopping (quiesce stopped the proxy but hasn't finished) or unknown: open only when the proxy
    is seen running without refusing writes."""
    try:
        if writes_closed(project):
            return "closed"
        record, state = closure_record(project), proxy_state(project)
        if record and record["by"] == STOPPING and state == "stopped":
            return "stopping"
        return "open" if state == "running" else "unknown"
    except (RuntimeError, ValueError):
        return "unknown"


def proxy_refuses_writes(project):
    """Whether the running proxy refuses a write as closed: it is asked one, from inside the stack. A proxy without
    the switch (an older image) answers otherwise, and a stopped one doesn't answer."""
    request = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "starknet_addInvokeTransaction", "params": [{}]})
    answer = docker(["exec", f"{project}-madara-1", "curl", "-s", "-m", "10", "-X", "POST", "-H",
                     "content-type: application/json", "-d", request, "http://rpc:8080/"], check=False).stdout
    try:
        return json.loads(answer).get("error", {}).get("message") == WRITES_CLOSED_MESSAGE
    except (json.JSONDecodeError, AttributeError):
        return False


def proxy_state(project):
    """running or stopped, as Docker says; anything else, an error included, is not an answer."""
    inspected = docker(["inspect", "-f", "{{.State.Running}}", f"{project}-rpc-1"], check=False)
    state = {"true": "running", "false": "stopped"}.get(inspected.stdout.strip())
    if inspected.returncode != 0 or state is None:
        raise RuntimeError(f"Docker could not say whether {project}-rpc-1 runs: "
                           f"{inspected.stderr.strip() or inspected.stdout.strip()}")
    return state


# The closure file's record: how writes were closed, and for a stopped proxy the relay's last read.
SWITCH, STOPPING, STOPPED = "switch", "stopping", "stopped"


def closure_path(project):
    return volume_path(f"{project}_public-config") / WRITES_CLOSED_FILE


def write_closure(project, record):
    path = closure_path(project)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(json.dumps(record) + "\n")
    temporary.replace(path)


def clear_closure(project):
    closure_path(project).unlink(missing_ok=True)


def closure_record(project):
    """The closure quiesce wrote, or None while there is none; a record it can't have written is refused."""
    path = closure_path(project)
    if not path.exists():
        return None
    record = json.loads(path.read_text())
    if record.get("by") == SWITCH and set(record) == {"by"}:
        return record
    if record.get("by") in (STOPPING, STOPPED) and set(record) == {"by", "relay_through"} \
            and type(record["relay_through"]) is int:
        return record
    raise ValueError(f"{path.name} holds no closure quiesce writes; run reopen, then quiesce")


def transactions_after(container, number):
    """How many transactions the node holds in the blocks after `number`, up to its head."""
    return transactions_between(container, number + 1, node_rpc(container, "starknet_blockNumber", []))


def transactions_between(container, first, last):
    """How many transactions the node holds in blocks `first` to `last`."""
    count = 0
    for start in range(first, last + 1, BLOCKS_PER_BATCH):
        batch = [{"jsonrpc": "2.0", "id": block, "method": "starknet_getBlockTransactionCount",
                  "params": [{"block_number": block}]} for block in range(start, min(start + BLOCKS_PER_BATCH, last + 1))]
        count += sum(answer["result"] for answer in node_batch(container, batch))
    return count


def verify(project, dest):
    """Every reason this copy cannot stand in for the running shard as drained; empty when it can."""
    record = json.loads((dest / "capture.json").read_text())
    result = json.loads((dest / "restore-test" / "result.json").read_text())
    problems = []
    try:
        verify_checksums(dest)
    except RuntimeError as error:
        problems.append(str(error))
    if record.get("project") != project or result.get("project") != project:
        problems.append("the copy is of another shard")
    if result.get("passed") is not True:
        problems.append("its restore test did not pass")
    head = record["chain"]["head"]
    node = f"{project}-madara-1"
    if node_block(node, {"block_number": head["block_number"]}) != head:
        problems.append("the running chain differs from the copy's head")
    state = boundary_state(project)
    if state != "closed":
        problems.append(f"the shard's writes are not shown closed ({state}): quiesce it, drain, then capture")
    accepted = transactions_after(node, head["block_number"])
    if accepted:
        problems.append(f"{accepted} transactions were accepted after the capture: capture the drained shard again")
    record = closure_record(project) if state == "closed" else None
    through = record["relay_through"] if record and record["by"] == STOPPED else None
    if through is not None and through < head["block_number"]:
        unread = transactions_between(node, through + 1, head["block_number"])
        if unread:
            problems.append(f"{unread} transactions are in blocks the relay never read: reopen, let it drain, then "
                            "quiesce and capture again")
    return problems


def capture_postgres(project, dest):
    container = f"{project}-postgres-1"
    started = time.monotonic()
    docker_to_file(["exec", container, "pg_basebackup", "-U", POSTGRES_USER, "-D", "-", "-Ft", "-X", "fetch", "-c", "fast",
                    "--manifest-checksums=SHA256"], dest / "base.tar")
    docker_to_file(["exec", container, "pg_dumpall", "-U", POSTGRES_USER, "--globals-only"], dest / "globals.sql")
    docker_to_file(["exec", container, "pg_dump", "-U", POSTGRES_USER, "-Fc", "-Z", "6", DATABASE], dest / "herald.dump")
    (dest / "counts-live.txt").write_text(table_counts(container, POSTGRES_USER))
    return {"seconds": round(time.monotonic() - started, 1)}


def capture_chain(project, dest):
    node = f"{project}-madara-1"
    head = node_block(node, "latest")
    stopped = time.monotonic()
    docker(["stop", "-t", str(STOP_GRACE_SECONDS), node])
    try:
        archive(volume_path(f"{project}_chain"), dest / "chain.tar.zst")
    finally:
        docker(["start", node])
    wait_for_node(node)
    return {"head": head, "downtime_seconds": round(time.monotonic() - stopped, 1),
            "bytes": (dest / "chain.tar.zst").stat().st_size, "args": container_args(node)}


def capture_files(project, data, dest):
    archive(data, dest / "data.tar.zst")
    return {"data": str(data)}


def service_images(project):
    containers = docker_output(["ps", "-a", "--filter", f"label=com.docker.compose.project={project}",
                                "--format", '{{.Label "com.docker.compose.service"}} {{.Image}}']).splitlines()
    return dict(line.split(" ", 1) for line in containers if line)


# Restore test


def restore_chain(project, record, dest, scratch):
    name = f"restore-{project}-chain"
    head = record["chain"]["head"]
    try:
        docker(["volume", "create", name])
        extract(dest / "chain.tar.zst", volume_path(name))
        # Chain configuration comes from the captured data directory, as the shard's init publishes it.
        extract(dest / "data.tar.zst", scratch / "data")
        docker(["run", "-d", "--name", name, "--network", "none", "-v", f"{name}:/data",
                "-v", f"{scratch / 'data' / 'chain-config.yaml'}:/config/chain-config.yaml:ro",
                record["images"]["madara"], *restored_node_args(record["chain"]["args"])])
        wait_for_node(name)
        restored = node_block(name, {"block_number": head["block_number"]})
    finally:
        docker(["rm", "-f", name], check=False)
        docker(["volume", "rm", name], check=False)
        shutil.rmtree(scratch / "data", ignore_errors=True)
    live = node_block(f"{project}-madara-1", {"block_number": head["block_number"]})
    return {"restored": restored, "live": live, "matches": restored == live == head}


def restore_postgres(record, dest, scratch):
    image = record["images"]["postgres"]
    live = parse_counts((dest / "counts-live.txt").read_text())
    base = restore_base_backup(image, dest, scratch)
    dump = restore_dump(image, dest)
    (scratch / "counts-base.txt").write_text(base["counts"])
    (scratch / "counts-dump.txt").write_text(dump["counts"])
    missing = {"base": missing_tables(live, parse_counts(base["counts"])),
               "dump": missing_tables(live, parse_counts(dump["counts"]))}
    return {"verified": base["verified"], "missing_tables": missing,
            "rows": {"live": sum(live.values()), "base": sum(parse_counts(base["counts"]).values()),
                     "dump": sum(parse_counts(dump["counts"]).values())},
            "complete": base["verified"] and not missing["base"] and not missing["dump"]}


def restore_base_backup(image, dest, scratch):
    name, directory = "restore-postgres-base", scratch / "pgbase"
    uid = docker_output(["run", "--rm", "--network", "none", image, "id", "-u", "postgres"])
    directory.mkdir(mode=0o700)
    try:
        subprocess.run(["tar", "-C", str(directory), "-xf", str(dest / "base.tar")], check=True)
        subprocess.run(["chown", "-R", f"{uid}:{uid}", str(directory)], check=True)
        verified = docker(["run", "--rm", "--network", "none", "-u", uid, "-v", f"{directory}:/pg", image,
                           "pg_verifybackup", "/pg"], check=False).returncode == 0
        docker(["run", "-d", "--name", name, "--network", "none", "-u", uid,
                "-v", f"{directory}:/var/lib/postgresql/data", image])
        wait_for_postgres(name, POSTGRES_USER)
        return {"verified": verified, "counts": table_counts(name, POSTGRES_USER)}
    finally:
        docker(["rm", "-f", name], check=False)
        shutil.rmtree(directory, ignore_errors=True)


def restore_dump(image, dest):
    name = "restore-postgres-dump"
    docker(["run", "-d", "--name", name, "--network", "none", "-e", "POSTGRES_USER=scratch",
            "-e", "POSTGRES_PASSWORD=scratch", image])
    try:
        wait_for_postgres(name, "scratch")
        docker_from_file(["exec", "-i", name, "psql", "-U", "scratch", "-d", "postgres", "-q"], dest / "globals.sql")
        docker(["exec", name, "createdb", "-U", "scratch", "-O", POSTGRES_USER, DATABASE])
        docker_from_file(["exec", "-i", name, "pg_restore", "-U", "scratch", "-d", DATABASE, "--exit-on-error"],
                         dest / "herald.dump")
        return {"counts": table_counts(name, "scratch")}
    finally:
        docker(["rm", "-f", name], check=False)


# The node's own flags, minus the collector it cannot reach from a scratch container without a network.
def restored_node_args(args):
    return [arg for arg in args if not arg.startswith("--otel-")]


def parse_counts(text):
    return {table: int(rows) for table, rows in (line.rsplit("|", 1) for line in text.splitlines() if line)}


def missing_tables(live, restored):
    return sorted(set(live) - set(restored))


# Docker, files and the node's RPC


def docker(arguments, check=True):
    return subprocess.run(["docker", *arguments], check=check, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


def docker_output(arguments):
    return docker(arguments).stdout.strip()


def docker_to_file(arguments, path):
    with open(path, "wb") as output:
        subprocess.run(["docker", *arguments], check=True, stdout=output)


def docker_from_file(arguments, path):
    with open(path, "rb") as source:
        subprocess.run(["docker", *arguments], check=True, stdin=source, stdout=subprocess.DEVNULL)


def table_counts(container, user):
    return subprocess.run(["docker", "exec", "-i", container, "psql", "-U", user, "-d", DATABASE, "-At", "-q"],
                          input=COUNTS_SQL, check=True, stdout=subprocess.PIPE, text=True).stdout


# The node's own flags: its command, without the image entrypoint that `.Args` would repeat.
def container_args(container):
    return json.loads(docker_output(["inspect", "-f", "{{json .Config.Cmd}}", container]))


def volume_path(volume):
    return Path(docker_output(["volume", "inspect", "-f", "{{.Mountpoint}}", volume]))


def archive(source, target):
    subprocess.run(["tar", "-C", str(source), "-I", "zstd -T4", "-cf", str(target), "."], check=True)


def extract(source, target):
    target.mkdir(mode=0o700, parents=True, exist_ok=True)
    subprocess.run(["tar", "-C", str(target), "-I", "zstd -T4", "-xf", str(source)], check=True)


def node_rpc(container, method, params):
    request = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
    response = docker_output(["exec", container, "curl", "-s", "-m", "5", "-X", "POST", "-H",
                              "content-type: application/json", "-d", request, "http://127.0.0.1:9944"])
    return json.loads(response)["result"]


def node_batch(container, requests):
    response = docker_output(["exec", container, "curl", "-s", "-m", "30", "-X", "POST", "-H",
                              "content-type: application/json", "-d", json.dumps(requests), "http://127.0.0.1:9944"])
    answers = json.loads(response)
    if not isinstance(answers, list) or len(answers) != len(requests) or any("result" not in answer for answer in answers):
        raise RuntimeError("The node did not answer every block in its batch")
    return answers


def node_block(container, block):
    result = node_rpc(container, "starknet_getBlockWithTxHashes", [block])
    return {key: result[key] for key in ("block_number", "block_hash", "new_root")}


def wait_for_node(container, attempts=90):
    for _ in range(attempts):
        try:
            node_rpc(container, "starknet_blockNumber", [])
            return
        except (subprocess.CalledProcessError, json.JSONDecodeError, KeyError):
            time.sleep(2)
    raise RuntimeError(f"{container} did not answer RPC")


# Over TCP: a fresh image's entrypoint first runs a socket-only server for initialization, then restarts it.
def wait_for_postgres(container, user, attempts=60):
    for _ in range(attempts):
        if docker(["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", user, "-q"], check=False).returncode == 0:
            return
        time.sleep(1)
    raise RuntimeError(f"{container} did not accept connections")


def write_checksums(dest):
    lines = [f"{sha256(path)}  {path.name}" for path in sorted(dest.iterdir()) if path.is_file()]
    (dest / "SHA256SUMS").write_text("\n".join(lines) + "\n")


def verify_checksums(dest):
    for line in (dest / "SHA256SUMS").read_text().splitlines():
        digest, name = line.split("  ", 1)
        if sha256(dest / name) != digest:
            raise RuntimeError(f"{name} does not match its checksum")


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as source:
        for block in iter(lambda: source.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


def utc_now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def main(argv):
    if os.geteuid() != 0:
        raise SystemExit("Run as root: capture reads Docker volumes directly")
    os.umask(0o077)
    if argv[:1] == ["capture"] and len(argv) == 4:
        with isolated_stack_lock(f"backup capture {argv[1]}", LOCK):
            record = capture(argv[1], Path(argv[2]).resolve(), Path(argv[3]).resolve())
        print(json.dumps(record, indent=2))
    elif argv[:1] == ["restore-test"] and len(argv) == 3:
        with isolated_stack_lock(f"backup restore-test {argv[1]}", LOCK):
            result = restore_test(argv[1], Path(argv[2]).resolve())
        print(json.dumps(result, indent=2))
        sys.exit(0 if result["passed"] else 1)
    elif argv[:1] == ["quiesce"] and len(argv) in (2, 3):
        try:
            print(json.dumps(quiesce(*argv[1:])))
        except (RuntimeError, ValueError, subprocess.CalledProcessError) as error:
            print(json.dumps({"project": argv[1], "writes": boundary_state(argv[1]), "problem": str(error)}))
            sys.exit(1)
    elif argv[:1] == ["reopen"] and len(argv) == 2:
        try:
            print(json.dumps(reopen(argv[1])))
        except (RuntimeError, ValueError, subprocess.CalledProcessError) as error:
            print(json.dumps({"project": argv[1], "writes": boundary_state(argv[1]), "problem": str(error)}))
            sys.exit(1)
    elif argv[:1] == ["verify"] and len(argv) == 3:
        problems = verify(argv[1], Path(argv[2]).resolve())
        print(json.dumps({"verified": not problems, "problems": problems}))
        sys.exit(0 if not problems else 1)
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
