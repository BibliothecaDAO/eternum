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

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
