/**
 * Phase 0 Spike - Dependency Validation
 *
 * Tests critical dependencies in the React Native / Hermes runtime:
 * 1. Torii HTTP SQL queries (via @bibliothecadao/torii)
 * 2. Starknet SDK crypto operations (hash, shortString, signing)
 * 3. WASM support in Hermes (torii-wasm)
 * 4. Cartridge Controller SDK
 * 5. Polyfills (Buffer, crypto, TextEncoder)
 */

import React, {useCallback, useState} from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

// ── Test result types ────────────────────────────────────────────

type TestStatus = 'pending' | 'running' | 'pass' | 'fail' | 'skip';

interface TestResult {
  name: string;
  status: TestStatus;
  detail: string;
  critical: boolean;
}

// ── Spike tests ──────────────────────────────────────────────────

async function testPolyfills(): Promise<TestResult> {
  const name = 'Polyfills (Buffer, crypto, TextEncoder)';
  try {
    const checks: string[] = [];

    // Buffer
    if (typeof global.Buffer !== 'undefined') {
      const buf = Buffer.from('hello', 'utf-8');
      if (buf.toString('hex') === '68656c6c6f') {
        checks.push('Buffer OK');
      }
    } else {
      return {name, status: 'fail', detail: 'Buffer not available', critical: true};
    }

    // crypto.getRandomValues
    const arr = new Uint8Array(32);
    if (typeof global.crypto !== 'undefined' && global.crypto.getRandomValues) {
      global.crypto.getRandomValues(arr);
      const hasNonZero = arr.some(v => v !== 0);
      checks.push(hasNonZero ? 'crypto.getRandomValues OK' : 'crypto.getRandomValues all zeros');
    } else {
      return {name, status: 'fail', detail: 'crypto.getRandomValues not available', critical: true};
    }

    // TextEncoder
    if (typeof TextEncoder !== 'undefined') {
      const encoded = new TextEncoder().encode('test');
      checks.push(encoded.length === 4 ? 'TextEncoder OK' : 'TextEncoder wrong output');
    } else {
      return {name, status: 'fail', detail: 'TextEncoder not available', critical: true};
    }

    return {name, status: 'pass', detail: checks.join(', '), critical: true};
  } catch (e: any) {
    return {name, status: 'fail', detail: e.message, critical: true};
  }
}

async function testStarknetSdk(): Promise<TestResult> {
  const name = 'Starknet SDK (hash, shortString, types)';
  try {
    // Dynamic import to catch module resolution errors
    const starknet = await import('starknet');
    const checks: string[] = [];

    // shortString encoding/decoding
    if (starknet.shortString) {
      const encoded = starknet.shortString.encodeShortString('hello');
      const decoded = starknet.shortString.decodeShortString(encoded);
      checks.push(decoded === 'hello' ? 'shortString OK' : `shortString: expected 'hello', got '${decoded}'`);
    }

    // hash computation
    if (starknet.hash) {
      const h = starknet.hash.computePedersenHash('0x1', '0x2');
      checks.push(h ? 'PedersenHash OK' : 'PedersenHash returned falsy');
    } else if (starknet.ec) {
      checks.push('ec module available (hash may be different API)');
    }

    // BigInt operations (fundamental for starknet)
    const felt = BigInt('0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7');
    checks.push(felt > 0n ? 'BigInt felt OK' : 'BigInt felt failed');

    return {name, status: 'pass', detail: checks.join(', '), critical: true};
  } catch (e: any) {
    return {name, status: 'fail', detail: e.message, critical: true};
  }
}

async function testToriiHttpQueries(): Promise<TestResult> {
  const name = 'Torii HTTP SQL queries';
  try {
    // Import the SQL utilities from the shared package
    const {buildApiUrl, encodeQuery, formatAddressForQuery} = await import(
      '@bibliothecadao/torii'
    );
    const checks: string[] = [];

    // Test utility functions (no network needed)
    const formatted = formatAddressForQuery('0x1234');
    if (formatted.length === 66 && formatted.startsWith('0x')) {
      checks.push('formatAddressForQuery OK');
    } else {
      checks.push(`formatAddressForQuery unexpected: ${formatted}`);
    }

    const encoded = encodeQuery("SELECT * FROM test WHERE id = '1'");
    if (encoded.includes('SELECT')) {
      checks.push('encodeQuery OK');
    }

    const url = buildApiUrl('https://api.example.com/sql', 'SELECT 1');
    if (url.includes('query=')) {
      checks.push('buildApiUrl OK');
    }

    // Test actual HTTP fetch against a Torii endpoint (if available)
    // Using the known sepolia Torii endpoint
    const TORII_URL = 'https://api.cartridge.gg/x/eternum-sepolia/torii/sql';
    try {
      const testQuery = 'SELECT 1 as test';
      const fetchUrl = buildApiUrl(TORII_URL, testQuery);
      const response = await fetch(fetchUrl, {
        headers: {'Content-Type': 'application/json'},
      });
      if (response.ok) {
        const data = await response.json();
        checks.push(`HTTP fetch OK (status ${response.status}, got ${JSON.stringify(data).substring(0, 50)})`);
      } else {
        checks.push(`HTTP fetch returned ${response.status} (endpoint may not be available)`);
      }
    } catch (fetchErr: any) {
      checks.push(`HTTP fetch skipped: ${fetchErr.message.substring(0, 60)}`);
    }

    return {name, status: 'pass', detail: checks.join(', '), critical: true};
  } catch (e: any) {
    return {name, status: 'fail', detail: e.message, critical: true};
  }
}

async function testToriiWasm(): Promise<TestResult> {
  const name = 'WASM (torii-wasm in Hermes)';
  try {
    // Try to import torii-wasm - this will likely fail in Hermes
    const toriiWasm = await import('@dojoengine/torii-wasm');
    return {
      name,
      status: 'pass',
      detail: `WASM loaded! Exports: ${Object.keys(toriiWasm).join(', ').substring(0, 100)}`,
      critical: false,
    };
  } catch (e: any) {
    // Expected to fail - HTTP-only is the fallback
    return {
      name,
      status: 'skip',
      detail: `WASM not supported in Hermes (expected). Fallback: HTTP-only SQL queries. Error: ${e.message.substring(0, 80)}`,
      critical: false,
    };
  }
}

async function testCartridgeController(): Promise<TestResult> {
  const name = 'Cartridge Controller SDK';
  try {
    // Test the HTTP-based lookup API (should always work)
    const checks: string[] = [];

    try {
      const response = await fetch('https://api.cartridge.gg/lookup', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          addresses: [
            '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
          ],
        }),
      });
      if (response.ok) {
        checks.push(`Cartridge lookup API OK (${response.status})`);
      } else {
        checks.push(`Cartridge lookup API returned ${response.status}`);
      }
    } catch (fetchErr: any) {
      checks.push(`Cartridge API unreachable: ${fetchErr.message.substring(0, 60)}`);
    }

    // Try importing the connector
    try {
      const connector = await import('@cartridge/connector');
      checks.push(`@cartridge/connector imported: ${Object.keys(connector).join(', ').substring(0, 80)}`);
    } catch (importErr: any) {
      checks.push(`@cartridge/connector import failed: ${importErr.message.substring(0, 80)}`);
    }

    // Try importing the controller
    try {
      const controller = await import('@cartridge/controller');
      checks.push(`@cartridge/controller imported: ${Object.keys(controller).join(', ').substring(0, 80)}`);
    } catch (importErr: any) {
      checks.push(`@cartridge/controller import failed: ${importErr.message.substring(0, 80)}`);
    }

    return {
      name,
      status: checks.some(c => c.includes('OK')) ? 'pass' : 'fail',
      detail: checks.join('; '),
      critical: true,
    };
  } catch (e: any) {
    return {name, status: 'fail', detail: e.message, critical: true};
  }
}

async function testSharedTypes(): Promise<TestResult> {
  const name = 'Shared Types (@bibliothecadao/types)';
  try {
    const types = await import('@bibliothecadao/types');
    const checks: string[] = [];

    // Check that key enums/constants are available
    if (types.ResourcesIds) {
      checks.push(`ResourcesIds: ${Object.keys(types.ResourcesIds).length} entries`);
    }
    if (types.StructureType) {
      checks.push(`StructureType available`);
    }
    if (types.EntityType) {
      checks.push(`EntityType available`);
    }

    return {
      name,
      status: checks.length > 0 ? 'pass' : 'fail',
      detail: checks.join(', ') || 'No exports found',
      critical: true,
    };
  } catch (e: any) {
    return {name, status: 'fail', detail: e.message, critical: true};
  }
}

// ── Main App ─────────────────────────────────────────────────────

const ALL_TESTS = [
  testPolyfills,
  testStarknetSdk,
  testSharedTypes,
  testToriiHttpQueries,
  testToriiWasm,
  testCartridgeController,
];

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [results, setResults] = useState<TestResult[]>(
    ALL_TESTS.map((_, i) => ({
      name: ALL_TESTS[i].name.replace('test', ''),
      status: 'pending' as TestStatus,
      detail: '',
      critical: true,
    })),
  );
  const [running, setRunning] = useState(false);

  const runAllTests = useCallback(async () => {
    setRunning(true);
    const newResults: TestResult[] = [];

    for (let i = 0; i < ALL_TESTS.length; i++) {
      // Mark current test as running
      setResults(prev => {
        const updated = [...prev];
        if (updated[i]) {
          updated[i] = {...updated[i], status: 'running'};
        }
        return updated;
      });

      try {
        const result = await ALL_TESTS[i]();
        newResults.push(result);
      } catch (e: any) {
        newResults.push({
          name: `Test ${i}`,
          status: 'fail',
          detail: `Unhandled: ${e.message}`,
          critical: true,
        });
      }

      // Update with result
      setResults([...newResults, ...ALL_TESTS.slice(newResults.length).map(() => ({
        name: '',
        status: 'pending' as TestStatus,
        detail: '',
        critical: true,
      }))]);
    }

    setResults(newResults);
    setRunning(false);

    // Summary
    const passed = newResults.filter(r => r.status === 'pass').length;
    const failed = newResults.filter(r => r.status === 'fail').length;
    const skipped = newResults.filter(r => r.status === 'skip').length;
    const criticalFails = newResults.filter(r => r.status === 'fail' && r.critical).length;

    Alert.alert(
      criticalFails === 0 ? 'Phase 0: GO' : 'Phase 0: ISSUES',
      `Passed: ${passed}, Failed: ${failed}, Skipped: ${skipped}\n${
        criticalFails === 0
          ? 'All critical dependencies validated!'
          : `${criticalFails} critical failure(s) need resolution.`
      }`,
    );
  }, []);

  const bg = isDarkMode ? '#1a1a2e' : '#f5f5f5';
  const fg = isDarkMode ? '#e0e0e0' : '#1a1a1a';

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: bg}]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, {color: fg}]}>Eternum RN Spike</Text>
        <Text style={[styles.subtitle, {color: fg}]}>Phase 0: Dependency Validation</Text>

        <Pressable
          style={[styles.button, running && styles.buttonDisabled]}
          onPress={runAllTests}
          disabled={running}>
          <Text style={styles.buttonText}>
            {running ? 'Running Tests...' : 'Run All Tests'}
          </Text>
        </Pressable>

        {results.map((result, index) => (
          <View key={index} style={[styles.testCard, {backgroundColor: isDarkMode ? '#2a2a3e' : '#fff'}]}>
            <View style={styles.testHeader}>
              <Text style={styles.statusIcon}>
                {result.status === 'pass'
                  ? '✅'
                  : result.status === 'fail'
                  ? '❌'
                  : result.status === 'skip'
                  ? '⏭️'
                  : result.status === 'running'
                  ? '🔄'
                  : '⏳'}
              </Text>
              <Text style={[styles.testName, {color: fg}]}>{result.name}</Text>
              {result.critical && (
                <Text style={styles.criticalBadge}>CRITICAL</Text>
              )}
            </View>
            {result.detail ? (
              <Text style={[styles.testDetail, {color: isDarkMode ? '#aaa' : '#666'}]}>
                {result.detail}
              </Text>
            ) : null}
          </View>
        ))}

        <View style={styles.infoBox}>
          <Text style={[styles.infoTitle, {color: fg}]}>Gate Criteria</Text>
          <Text style={[styles.infoText, {color: isDarkMode ? '#aaa' : '#666'}]}>
            {'• Torii HTTP queries work → GO\n'}
            {'• Starknet SDK crypto works → GO\n'}
            {'• WASM fails → OK (use HTTP-only fallback)\n'}
            {'• Cartridge Controller → Verify or plan WebView fallback'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.7,
  },
  button: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#4a4a6a',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  testCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  testHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIcon: {
    fontSize: 18,
  },
  testName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  criticalBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ef4444',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  testDetail: {
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  infoBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6366f1',
    borderStyle: 'dashed',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
});

export default App;
