# /// script
# requires-python = "==3.12.*"
# dependencies = ["ijson==3.4.0"]
# ///
"""Extract action costs without retaining the VM steps in memory."""

import argparse
import hashlib
import json
from pathlib import Path

import ijson


def read_call_tree(path):
    stack = []
    result = None
    with path.open("rb") as source:
        for prefix, event, value in ijson.parse(source):
            if "cairo_execution_info" in prefix:
                continue
            if event == "map_key":
                if value != "cairo_execution_info":
                    stack[-1][1] = value
                continue
            if event in ("end_map", "end_array"):
                stack.pop()
                continue
            container = event in ("start_map", "start_array")
            if container:
                value = {} if event == "start_map" else []
            elif event not in ("string", "number", "boolean", "null"):
                continue
            if stack:
                parent, key = stack[-1]
                if isinstance(parent, list):
                    parent.append(value)
                else:
                    parent[key] = value
            else:
                result = value
            if container:
                stack.append([value, None])
    return result


def descendants(call):
    for nested in call.get("nested_calls", []):
        if "EntryPointCall" in nested:
            child = nested["EntryPointCall"]
            yield child
            yield from descendants(child)


def execution_cost(call):
    resources = call["used_execution_resources"]
    events = list(call["entry_point"]["events_summary"])
    for child in descendants(call):
        events.extend(child["entry_point"]["events_summary"])
    return {
        "storageWrites": resources["syscall_counter"].get("StorageWrite", {}).get("call_count", 0),
        "events": len(events),
        "eventFelts": sum(event["keys_len"] + event["data_len"] for event in events),
        "l2Gas": resources["gas_consumed"],
        "classHash": call["entry_point"]["class_hash"],
    }


def pair_actions(tree, fixture, schema):
    actions = []
    for call in descendants(tree):
        entry = call["entry_point"]
        if entry["contract_name"] in fixture["systems"] and entry["function_name"] in fixture["commands"]:
            if actions and "nativeExecution" not in actions[-1]:
                raise ValueError("Oracle action lacks its native execution")
            actions.append({"command": entry["function_name"], "dojo": execution_cost(call)})
        if entry["contract_name"] == schema["domains"]["season"]["contract"] and entry["function_name"] == "execute":
            if not actions or "nativeExecution" in actions[-1]:
                raise ValueError("Native execution lacks its oracle action")
            command = actions[-1]["command"]
            native_command = fixture.get("nativeCommands", {}).get(command, command)
            domain_calls = [
                child for child in descendants(call)
                if child["entry_point"]["function_name"] == native_command
            ]
            if len(domain_calls) != 1:
                raise ValueError("Expected one gameplay domain command per action")
            actions[-1]["nativeExecution"] = execution_cost(call)
            actions[-1]["nativeGameplay"] = execution_cost(domain_calls[0])
    if not actions or "nativeExecution" not in actions[-1]:
        raise ValueError("Incomplete action costs")
    if len(actions) != len(fixture["measuredSequence"]):
        raise ValueError("Measured action count differs from the declared workload")
    for action, expected in zip(actions, fixture["measuredSequence"], strict=True):
        if action["command"] != expected["command"]:
            raise ValueError("Measured action order differs from the declared workload")
        action["case"] = expected["case"]
        action["expectedSuccess"] = expected["succeeded"]
        action["oracleExpectedSuccess"] = expected.get("oracleSucceeded", expected["succeeded"])
    return actions


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("trace", type=Path)
    parser.add_argument("fixture", type=Path)
    parser.add_argument("schema", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    tree = read_call_tree(args.trace)
    actions = pair_actions(tree, json.loads(args.fixture.read_text()), json.loads(args.schema.read_text()))
    with args.trace.open("rb") as source:
        digest = hashlib.file_digest(source, "sha256").hexdigest()
    call_tree = json.dumps(tree, separators=(",", ":")).encode()
    call_tree_path = args.output.with_suffix(".calls.json")
    call_tree_path.write_bytes(call_tree)
    result = {
        "version": 1,
        "callTree": {"file": call_tree_path.name, "sha256": hashlib.sha256(call_tree).hexdigest()},
        "traceSha256": digest,
        "accounting": "Inclusive execution counters at each action entrypoint, including attempted operations before rollback. Event counts sum local emissions across descendants; syscall and gas counters are already inclusive. Account validation and fees are outside this fixture.",
        "actions": actions,
    }
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"actionsMeasured": len(actions), "output": str(args.output)}))


if __name__ == "__main__":
    main()
