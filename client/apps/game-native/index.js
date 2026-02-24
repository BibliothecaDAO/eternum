/**
 * Eternum Game Native - Entry Point
 *
 * Polyfills must be imported before anything else to ensure
 * starknet SDK and shared packages work in Hermes runtime.
 */

// Crypto polyfill - must be first
import 'react-native-get-random-values';

// Buffer polyfill for starknet SDK
import {Buffer} from 'buffer';
global.Buffer = Buffer;

// TextEncoder/TextDecoder polyfill
import 'text-encoding';

// localStorage shim for @bibliothecadao/eternum compatibility
// Uses in-memory cache backed by AsyncStorage (async init in App.tsx)
import {storage} from './src/shared/lib/storage';
global.localStorage = storage;

import {AppRegistry} from 'react-native';
import App from './src/app/App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
