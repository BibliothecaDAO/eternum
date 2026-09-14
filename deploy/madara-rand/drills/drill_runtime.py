"""Local fault injection and retained-record inspection shared by recovery drills."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import json
import threading
import urllib.request
from runtime import primary_service, run

RESULT_SELECTOR = '0x1179ac451c36b461fcd4401eb9dc86c94d30a9eae5cb26d828ff914320a45db'


def write_drill_report(output, result):
    artifacts = {str(path.relative_to(output)): hashlib.sha256(path.read_bytes()).hexdigest()
                 for path in sorted(output.rglob('*')) if path.is_file()}
    report = {'schema': 1, **result, 'artifacts': artifacts}
    with (output / 'report.json').open('x') as stream:
        stream.write(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'report': str(output / 'report.json'), 'passed': True}))


def journal_snapshot(command, deployment, database, output):
    query = """SELECT coalesce(json_agg(row_to_json(t) ORDER BY ticket_order),'[]') FROM
        (SELECT ticket_order,status,encode(action,'hex') action,encode(envelope,'hex') envelope,
         encode(binding,'hex') binding,encode(result,'hex') result FROM randomness.tickets) t"""
    run([*command, 'exec', '-T', primary_service(command), 'psql', '-U', 'postgres', '-d', database, '-Atc', query],
        output, deployment)
    return json.loads(output.read_text())


def chain_result(fixture, order):
    request = urllib.request.Request(fixture['rpc'], headers={'content-type': 'application/json'}, data=json.dumps({
        'jsonrpc': '2.0', 'id': 1, 'method': 'starknet_call', 'params': {'block_id': 'pre_confirmed', 'request': {
            'contract_address': fixture['execution']['address'], 'entry_point_selector': RESULT_SELECTOR,
            'calldata': [hex(order)]}}}).encode())
    with urllib.request.urlopen(request, timeout=5) as response:
        result = json.load(response)
    if 'error' in result:
        raise RuntimeError(result['error'])
    return result['result']


def fault_proxy(gateway, mode, output, reached, release):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def do_POST(self):
            body = self.rfile.read(int(self.headers['content-length']))
            invocation = json.loads(body).get('method') == 'starknet_addInvokeTransaction'
            if invocation:
                with (output / 'submitted-transaction.json').open('xb') as stream:
                    stream.write(body)
                if mode == 'before-broadcast':
                    reached.set()
                    release.wait()
                    return
            request = urllib.request.Request('http://127.0.0.1:15050', data=body,
                                             headers={'content-type': 'application/json'})
            with urllib.request.urlopen(request, timeout=30) as response:
                data = response.read()
            if invocation:
                (output / 'broadcast-response.json').write_bytes(data)
                reached.set()
                release.wait()
                return
            self.send_response(200)
            self.send_header('content-type', 'application/json')
            self.send_header('content-length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

    server = ThreadingHTTPServer((gateway, 15052), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server
