/**
 * NFT Traits Data Processing Script
 * 
 * This script processes NFT trait metadata for deployment to StarkNet smart contracts.
 * It validates trait data structure, ensures uniqueness constraints, and generates
 * calldata for smart contract functions that manage NFT traits and IPFS mappings.
 * 
 * Key Features:
 * - Validates trait type and value structure (max 16 trait types, 255 values per type)
 * - Ensures uniqueness of trait names within their respective scopes
 * - Converts trait combinations to compact binary representation (attrsRaw)
 * - Generates StarkNet calldata for contract deployment functions
 * - Supports overwrite functionality for updating existing trait data
 * 
 * Data Structure:
 * - Trait Types: Maximum 16 types (0-15), each with a unique ID and name
 * - Trait Values: Maximum 255 values per type (1-255), each with unique ID within type
 * - Traits Combinations: String format "TraitType1:Value1,TraitType2:Value2"
 * - AttrsRaw: Binary encoding where each trait type occupies 8 bits (1 byte)
 * 
 * Binary Encoding Example:
 * For traits "Skin:Smooth,Structure:Village,Eyes:Normal" where:
 * - Skin (type 0): Smooth (value 1) -> bits 0-7
 * - Structure (type 1): Village (value 2) -> bits 8-15  
 * - Eyes (type 2): Normal (value 1) -> bits 16-23
 * Result: 0x010201 (hex representation)
 * 
 * Usage:
 * import { processData } from './process.js';
 * const result = processData('example.json', false);
 */

import { readFileSync } from "fs";
import { byteArray } from "starknet";

/**
 * Main processing function that orchestrates the entire trait data processing pipeline.
 * 
 * This function reads trait data from a JSON file, validates it, and generates
 * calldata arrays suitable for StarkNet smart contract deployment. It processes
 * trait types, trait values, and their combinations with IPFS CIDs.
 * 
 * @param {string} fileName - Path to the JSON file containing trait data
 * @param {boolean} [onlyProcessOverwriten=false] - If true, only processes items marked for overwrite
 * @returns {Object} Processed data object containing:
 *   - name: Collection name
 *   - symbol: Collection symbol  
 *   - defaultIpfsCid: Default IPFS CID for fallback metadata
 *   - setTraitTypesNameCalldata: Array of calldata for setting trait type names
 *   - setTraitValueNameCalldata: Array of calldata for setting trait value names
 *   - setAttrsRawToIPFSCIDCalldata: Array of calldata for mapping trait combinations to IPFS CIDs
 * @throws {Error} When file cannot be read or JSON is invalid
 */
export function processData(fileName) {
    // log the present directory
    console.log("Current directory:", process.cwd());
    console.log("Processing file:", fileName);
    const data = JSON.parse(readFileSync(fileName, "utf8"));
    const { name, symbol, updateContractAddress, defaultIpfsCid, defaultIpfsCidOverwrite, traits, traitsCombinedIpfsCid } = data;
    
    let onlyProcessOverwriten = false;
    if (updateContractAddress) {
        onlyProcessOverwriten = true;
        console.log("Only processing overwriten data");
    }

    // Initialize data structures for processing
    const {
        traitsTypeIdToNamesMap,
        traitsTypeNameToIdMap,
        traitsValuesToNamesMap,
        traitsValuesNameToIdMap,
        dataOverwriteMap
    } = initializeDataStructures();
    
    // Process and validate traits
    processTraits(traits, traitsTypeIdToNamesMap, traitsTypeNameToIdMap, traitsValuesToNamesMap, traitsValuesNameToIdMap, dataOverwriteMap);
    
    // Validate traits combinations
    validateTraitsCombinations(traitsCombinedIpfsCid, traitsTypeNameToIdMap, traitsValuesNameToIdMap);
    
    // Generate call data for smart contract functions
    const setTraitTypesNameCalldata = generateTraitTypesCalldata(traitsTypeIdToNamesMap, dataOverwriteMap, onlyProcessOverwriten);
    const setTraitValueNameCalldata = generateTraitValuesCalldata(traitsValuesToNamesMap, dataOverwriteMap, onlyProcessOverwriten);
    const setAttrsRawToIPFSCIDCalldata = generateAttrsRawCalldata(traitsCombinedIpfsCid, traitsTypeNameToIdMap, traitsValuesNameToIdMap, onlyProcessOverwriten);
    const setDefaultIpfsCidCalldata = generateDefaultIpfsCidCalldata(defaultIpfsCid, defaultIpfsCidOverwrite, onlyProcessOverwriten);
    const result = { name, symbol, updateContractAddress, setDefaultIpfsCidCalldata, setTraitTypesNameCalldata, setTraitValueNameCalldata, setAttrsRawToIPFSCIDCalldata };
    
    // Beautiful logging of the processed data
    logProcessedData(result, fileName, onlyProcessOverwriten);
    
    return result;
}

/**
 * Initializes all Map data structures used throughout the processing pipeline.
 * 
 * These maps serve different purposes:
 * - traitsTypeIdToNamesMap: Quick lookup from trait type ID to name
 * - traitsTypeNameToIdMap: Quick lookup from trait type name to ID  
 * - traitsValuesToNamesMap: Maps composite keys (typeId:valueId) to value names
 * - traitsValuesNameToIdMap: Maps composite keys (typeName:valueName) to value IDs
 * - dataOverwriteMap: Tracks which items should be overwritten during updates
 * 
 * @returns {Object} Object containing all initialized Map instances
 */
function initializeDataStructures() {
    return {
        traitsTypeIdToNamesMap: new Map(),
        traitsTypeNameToIdMap: new Map(),
        traitsValuesToNamesMap: new Map(),
        traitsValuesNameToIdMap: new Map(),
        dataOverwriteMap: new Map()
    };
}

/**
 * Processes and validates all trait types and their associated values.
 * 
 * This function iterates through all traits, validates their structure,
 * ensures uniqueness constraints, and populates the mapping data structures.
 * It enforces the maximum limits (16 trait types, 255 values per type).
 * 
 * @param {Array} traits - Array of trait objects from JSON data
 * @param {Map} traitsTypeIdToNamesMap - Map from trait type ID to name
 * @param {Map} traitsTypeNameToIdMap - Map from trait type name to ID
 * @param {Map} traitsValuesToNamesMap - Map from composite key to trait value name
 * @param {Map} traitsValuesNameToIdMap - Map from composite name key to trait value ID
 * @param {Map} dataOverwriteMap - Map tracking overwrite flags
 * @throws {Error} When trait structure is invalid or limits are exceeded
 */
function processTraits(traits, traitsTypeIdToNamesMap, traitsTypeNameToIdMap, traitsValuesToNamesMap, traitsValuesNameToIdMap, dataOverwriteMap) {
    const seenTraitTypeNames = new Set();
    const seenTraitValueNames = new Map(); // Maps trait type ID to Set of seen value names
    
    let currentTraitTypeId = 0;
    traits.forEach((trait) => {
        validateTraitTypeStructure(trait, currentTraitTypeId);
        processTraitType(trait, currentTraitTypeId, seenTraitTypeNames, seenTraitValueNames, traitsTypeIdToNamesMap, traitsTypeNameToIdMap, dataOverwriteMap);
        processTraitValues(trait, currentTraitTypeId, seenTraitValueNames, traitsValuesToNamesMap, traitsValuesNameToIdMap, dataOverwriteMap);
        currentTraitTypeId++;
    });
}

/**
 * Validates the structure and constraints of a single trait type.
 * 
 * Enforces business rules:
 * - Maximum 16 trait types (IDs 0-15)
 * - Trait type IDs must be sequential starting from 0
 * - Maximum 255 trait values per trait type
 * 
 * @param {Object} trait - Single trait object containing traitTypeId, traitTypeName, and traitValues
 * @param {number} expectedTraitTypeId - Expected sequential ID for this trait type
 * @throws {Error} When constraints are violated
 */
function validateTraitTypeStructure(trait, expectedTraitTypeId) {
    if (expectedTraitTypeId > 15) {
        throw new Error(`There can be only 16 trait types`);
    }
    if (expectedTraitTypeId != trait.traitTypeId) {
        throw new Error(`Incorrectly ordered traits: Trait type id mismatch: ${expectedTraitTypeId} != ${trait.traitTypeId}, ${trait}`);
    }
    if (trait.traitValues.length > 255) {
        throw new Error(`Too many trait values at traitTypeId ${expectedTraitTypeId}: maximum 255 allowed`);
    }
}

/**
 * Processes a single trait type, validating uniqueness and storing in maps.
 * 
 * This function ensures trait type names are unique across the entire collection
 * and sets up the data structures for processing trait values.
 * 
 * @param {Object} trait - Trait object with traitTypeName and traitTypeNameOverwrite
 * @param {number} traitTypeId - ID of the trait type being processed
 * @param {Set} seenTraitTypeNames - Set tracking all seen trait type names for uniqueness
 * @param {Map} seenTraitValueNames - Map from trait type ID to Set of seen value names
 * @param {Map} traitsTypeIdToNamesMap - Map to store trait type ID to name mapping
 * @param {Map} traitsTypeNameToIdMap - Map to store trait type name to ID mapping
 * @param {Map} dataOverwriteMap - Map to store overwrite flags
 * @throws {Error} When duplicate trait type names are found
 */
function processTraitType(trait, traitTypeId, seenTraitTypeNames, seenTraitValueNames, traitsTypeIdToNamesMap, traitsTypeNameToIdMap, dataOverwriteMap) {
    if (seenTraitTypeNames.has(trait.traitTypeName)) {
        throw new Error(`Duplicate trait type name: ${trait.traitTypeName}`);
    }
    
    seenTraitTypeNames.add(trait.traitTypeName);
    seenTraitValueNames.set(traitTypeId, new Set()); // Initialize set for this trait type's values
    
    // Store bidirectional mappings for quick lookup
    traitsTypeIdToNamesMap.set(traitTypeId, trait.traitTypeName);
    traitsTypeNameToIdMap.set(trait.traitTypeName, traitTypeId);
    dataOverwriteMap.set(traitTypeId, trait.traitTypeNameOverwrite);
}

/**
 * Processes all trait values for a specific trait type.
 * 
 * Validates each trait value's structure, ensures uniqueness within the trait type,
 * and stores the mapping data. Trait value IDs must be sequential starting from 1.
 * 
 * @param {Object} trait - Trait object containing traitValues array
 * @param {number} traitTypeId - ID of the parent trait type
 * @param {Map} seenTraitValueNames - Map tracking seen value names per trait type
 * @param {Map} traitsValuesToNamesMap - Map to store composite key to value name mapping
 * @param {Map} traitsValuesNameToIdMap - Map to store composite name key to value ID mapping
 * @param {Map} dataOverwriteMap - Map to store overwrite flags
 */
function processTraitValues(trait, traitTypeId, seenTraitValueNames, traitsValuesToNamesMap, traitsValuesNameToIdMap, dataOverwriteMap) {
    let currentTraitValueId = 1; // Trait value IDs start from 1 (0 reserved for "none")
    trait.traitValues.forEach((traitValue) => {
        validateTraitValueStructure(traitValue, currentTraitValueId);
        validateTraitValueUniqueness(traitValue, traitTypeId, trait.traitTypeName, seenTraitValueNames);
        storeTraitValueData(trait, traitValue, traitTypeId, currentTraitValueId, traitsValuesToNamesMap, traitsValuesNameToIdMap, dataOverwriteMap);
        currentTraitValueId++;
    });
}

/**
 * Validates the structure of a single trait value.
 * 
 * Ensures trait value IDs are sequential starting from 1 and match expected values.
 * 
 * @param {Object} traitValue - Trait value object with traitValueId
 * @param {number} expectedTraitValueId - Expected sequential ID for this trait value
 * @throws {Error} When trait value ID doesn't match expected sequence
 */
function validateTraitValueStructure(traitValue, expectedTraitValueId) {
    if (expectedTraitValueId != traitValue.traitValueId) {
        throw new Error(`Incorrectly ordered traits: Trait value id mismatch: ${expectedTraitValueId} != ${traitValue.traitValueId}, ${traitValue}`);
    }
}

/**
 * Validates that trait value names are unique within their trait type.
 * 
 * Each trait type can have multiple values, but value names must be unique
 * within that specific trait type (e.g., "Red" can exist in both "Color" and "Background").
 * 
 * @param {Object} traitValue - Trait value object with traitValueName
 * @param {number} traitTypeId - ID of the parent trait type
 * @param {string} traitTypeName - Name of the parent trait type (for error messages)
 * @param {Map} seenTraitValueNames - Map from trait type ID to Set of seen value names
 * @throws {Error} When duplicate trait value names are found within the same trait type
 */
function validateTraitValueUniqueness(traitValue, traitTypeId, traitTypeName, seenTraitValueNames) {
    const traitValueNamesSet = seenTraitValueNames.get(traitTypeId);
    if (traitValueNamesSet.has(traitValue.traitValueName)) {
        throw new Error(`Duplicate trait value name "${traitValue.traitValueName}" in trait type "${traitTypeName}"`);
    }
    traitValueNamesSet.add(traitValue.traitValueName);
}

/**
 * Stores trait value data in the appropriate mapping structures.
 * 
 * Creates composite keys for efficient lookup and stores both directions of mapping:
 * - Composite key (typeId:valueId) -> value name
 * - Composite name key (typeName:valueName) -> value ID
 * 
 * @param {Object} trait - Parent trait object with traitTypeName
 * @param {Object} traitValue - Trait value object with traitValueName and traitValueNameOverwrite
 * @param {number} traitTypeId - ID of the parent trait type
 * @param {number} traitValueId - ID of this trait value
 * @param {Map} traitsValuesToNamesMap - Map to store composite key to value name mapping
 * @param {Map} traitsValuesNameToIdMap - Map to store composite name key to value ID mapping
 * @param {Map} dataOverwriteMap - Map to store overwrite flags
 */
function storeTraitValueData(trait, traitValue, traitTypeId, traitValueId, traitsValuesToNamesMap, traitsValuesNameToIdMap, dataOverwriteMap) {
    const compositeKey = `${traitTypeId}:${traitValueId}`;
    dataOverwriteMap.set(compositeKey, traitValue.traitValueNameOverwrite);
    traitsValuesToNamesMap.set(compositeKey, traitValue.traitValueName);
    traitsValuesNameToIdMap.set(`${trait.traitTypeName}:${traitValue.traitValueName}`, traitValueId);
}

/**
 * Validates all trait combinations and their associated IPFS CIDs.
 * 
 * This function ensures that:
 * - All trait combinations are unique
 * - Each combination references valid trait types and values
 * - IPFS CID format is valid
 * - Overwrite flags are properly set
 * 
 * @param {Array} traitsCombinedIpfsCid - Array of objects with traits, ipfsCid, and overwrite
 * @param {Map} traitsTypeNameToIdMap - Map from trait type name to ID for validation
 * @param {Map} traitsValuesNameToIdMap - Map from composite name key to value ID for validation
 * @throws {Error} When trait combinations are invalid or duplicated
 */
function validateTraitsCombinations(traitsCombinedIpfsCid, traitsTypeNameToIdMap, traitsValuesNameToIdMap) {
    const seenTraitsCombinations = new Set();
    
    traitsCombinedIpfsCid.forEach((item, index) => {
        validateTraitsCombinationItem(item, index);
        
        // Check for duplicate trait combinations
        if (seenTraitsCombinations.has(item.traits)) {
            throw new Error(`Duplicate trait combination: ${item.traits}`);
        }
        seenTraitsCombinations.add(item.traits);
        
        // Validate that all trait types and values in the combination exist
        validateTraitsCombination(item.traits, traitsTypeNameToIdMap, traitsValuesNameToIdMap);
    });
}

/**
 * Validates the structure of a single trait combination item.
 * 
 * Ensures each item has:
 * - Valid non-empty traits string
 * - Valid IPFS CID string
 * - Boolean overwrite flag
 * 
 * @param {Object} item - Single trait combination object
 * @param {number} index - Index in array (for error reporting)
 * @throws {Error} When item structure is invalid
 */
function validateTraitsCombinationItem(item, index) {
    if (!item.traits || typeof item.traits !== 'string' || item.traits.trim().length === 0) {
        throw new Error(`Invalid traits string at index ${index}: must be a non-empty string`);
    }
    if (!item.ipfsCid || typeof item.ipfsCid !== 'string') {
        throw new Error(`Invalid ipfsCid at index ${index}: must be a valid IPFS CID`);
    }
    if (typeof item.overwrite !== 'boolean') {
        throw new Error(`Invalid overwrite at index ${index}: must be a boolean`);
    }
}

/**
 * Generates calldata array for setting trait type names in the smart contract.
 * 
 * Creates an array where each element is [traitTypeId, byteArrayName, overwrite].
 * The byteArrayName is the trait type name converted to StarkNet byte array format.
 * 
 * @param {Map} traitsTypeIdToNamesMap - Map from trait type ID to name
 * @param {Map} dataOverwriteMap - Map containing overwrite flags
 * @param {boolean} onlyProcessOverwriten - If true, only include items marked for overwrite
 * @returns {Array} Array of calldata tuples for setTraitTypeName function
 */
function generateTraitTypesCalldata(traitsTypeIdToNamesMap, dataOverwriteMap, onlyProcessOverwriten) {
    let setTraitTypesNameCalldata = [];
    
    for (const [traitTypeId, traitTypeName] of traitsTypeIdToNamesMap.entries()) {
        if (onlyProcessOverwriten) {
            let overwrite = dataOverwriteMap.get(traitTypeId);
            if (overwrite) {
                setTraitTypesNameCalldata.push([traitTypeId, byteArray.byteArrayFromString(traitTypeName), overwrite]);
            }
        } else {
            // Include all trait types, defaulting overwrite to false
            setTraitTypesNameCalldata.push([traitTypeId, byteArray.byteArrayFromString(traitTypeName), false]);
        }
    }
    
    return setTraitTypesNameCalldata;
}

/**
 * Generates calldata array for setting trait value names in the smart contract.
 * 
 * Creates an array where each element is [traitTypeId, traitValueId, byteArrayName, overwrite].
 * The composite key format ensures proper mapping of values to their parent trait types.
 * 
 * @param {Map} traitsValuesToNamesMap - Map from composite key to trait value name
 * @param {Map} dataOverwriteMap - Map containing overwrite flags
 * @param {boolean} onlyProcessOverwriten - If true, only include items marked for overwrite
 * @returns {Array} Array of calldata tuples for setTraitValueName function
 */
function generateTraitValuesCalldata(traitsValuesToNamesMap, dataOverwriteMap, onlyProcessOverwriten) {
    let setTraitValueNameCalldata = [];
    
    for (const [key, traitValueName] of traitsValuesToNamesMap.entries()) {
        const [traitTypeId, traitValueId] = key.split(':').map(Number);
        if (onlyProcessOverwriten) {
            const compositeKey = `${traitTypeId}:${traitValueId}`;
            let overwrite = dataOverwriteMap.get(compositeKey);
            if (overwrite) {
                setTraitValueNameCalldata.push([traitTypeId, traitValueId, byteArray.byteArrayFromString(traitValueName), overwrite]);
            }
        } else {
            // Include all trait values, defaulting overwrite to false
            setTraitValueNameCalldata.push([traitTypeId, traitValueId, byteArray.byteArrayFromString(traitValueName), false]);
        }
    }
    
    return setTraitValueNameCalldata;
}

/**
 * Generates calldata array for mapping trait combinations to IPFS CIDs.
 * 
 * Converts each trait combination string to its binary attrsRaw representation
 * and creates calldata tuples [attrsRaw, byteArrayIpfsCid, overwrite].
 * 
 * @param {Array} traitsCombinedIpfsCid - Array of trait combination objects
 * @param {Map} traitsTypeNameToIdMap - Map from trait type name to ID
 * @param {Map} traitsValuesNameToIdMap - Map from composite name key to value ID
 * @param {boolean} onlyProcessOverwriten - If true, only include items marked for overwrite
 * @returns {Array} Array of calldata tuples for setAttrsRawToIPFSCID function
 */
function generateAttrsRawCalldata(traitsCombinedIpfsCid, traitsTypeNameToIdMap, traitsValuesNameToIdMap, onlyProcessOverwriten) {
    let setAttrsRawToIPFSCIDCalldata = [];
    
    for (const item of traitsCombinedIpfsCid) {
        const { traits, ipfsCid, overwrite } = item;
        const attrsRaw = getAttrsRawFromTraitsString(traits, traitsTypeNameToIdMap, traitsValuesNameToIdMap);
        if (onlyProcessOverwriten) {
            if (overwrite) {
                setAttrsRawToIPFSCIDCalldata.push([attrsRaw, byteArray.byteArrayFromString(ipfsCid), overwrite]);
            }
        } else {
            // Include all combinations, using the specified overwrite flag
            setAttrsRawToIPFSCIDCalldata.push([attrsRaw, byteArray.byteArrayFromString(ipfsCid), false]);
        }
    }
    
    return setAttrsRawToIPFSCIDCalldata;
}

function generateDefaultIpfsCidCalldata(defaultIpfsCid, defaultIpfsCidOverwrite, onlyProcessOverwriten) {
    let setDefaultIpfsCidCalldata = [];
    if (onlyProcessOverwriten) {
        if (defaultIpfsCidOverwrite) {
            setDefaultIpfsCidCalldata.push([byteArray.byteArrayFromString(defaultIpfsCid), true]);
        }   
    } else {
        setDefaultIpfsCidCalldata.push([byteArray.byteArrayFromString(defaultIpfsCid), false]);
    }
    return setDefaultIpfsCidCalldata;
}


/**
 * Validates a traits combination string format and references.
 * 
 * Validates that:
 * - String format is "TraitType1:TraitValue1,TraitType2:TraitValue2,..."
 * - No duplicate trait types within the combination
 * - All referenced trait types and values exist in the data
 * - No empty trait type or value names
 * 
 * @param {string} traitsString - Comma-separated traits in "Type:Value" format
 * @param {Map} traitsTypeNameToIdMap - Map from trait type name to ID for validation
 * @param {Map} traitsValuesNameToIdMap - Map from composite name key to value ID for validation
 * @throws {Error} When traits combination format or references are invalid
 */
function validateTraitsCombination(traitsString, traitsTypeNameToIdMap, traitsValuesNameToIdMap) {
    const traits = traitsString.split(",");
    const seenTraitTypes = new Set();
    
    traits.forEach((trait) => {
        const parts = trait.split(":");
        if (parts.length !== 2) {
            throw new Error(`Invalid trait format: ${trait}. Expected format: "TraitType:TraitValue"`);
        }
        
        const [traitTypeName, traitValueName] = parts;
        
        if (!traitTypeName || !traitValueName) {
            throw new Error(`Empty trait type or value in: ${trait}`);
        }
        
        // Ensure no duplicate trait types in the same combination
        if (seenTraitTypes.has(traitTypeName)) {
            throw new Error(`Duplicate trait type "${traitTypeName}" in combination: ${traitsString}`);
        }
        seenTraitTypes.add(traitTypeName);
        
        // Validate trait type exists
        if (!traitsTypeNameToIdMap.has(traitTypeName)) {
            throw new Error(`Unknown trait type: ${traitTypeName}`);
        }
        
        // Validate trait value exists for this trait type
        const lookupKey = `${traitTypeName}:${traitValueName}`;
        if (!traitsValuesNameToIdMap.has(lookupKey)) {
            throw new Error(`Unknown trait value: ${traitValueName} for trait type: ${traitTypeName}`);
        }
    });
}

/**
 * Converts a traits combination string to its binary attrsRaw representation.
 * 
 * The attrsRaw format uses bit shifting to encode multiple trait values into a single number:
 * - Each trait type occupies 8 bits (1 byte)
 * - Trait type 0 uses bits 0-7, type 1 uses bits 8-15, etc.
 * - The trait value ID is stored in those 8 bits
 * 
 * Example: "Skin:Smooth,Structure:Village,Eyes:Normal"
 * - Skin (type 0): Smooth (value 1) -> 0x000001
 * - Structure (type 1): Village (value 2) -> 0x000200  
 * - Eyes (type 2): Normal (value 1) -> 0x010000
 * - Combined: 0x010201
 * 
 * @param {string} traitsString - Comma-separated traits in "Type:Value" format
 * @param {Map} traitsTypeNameToIdMap - Map from trait type name to ID
 * @param {Map} traitsValuesNameToIdMap - Map from composite name key to value ID
 * @returns {string} Hexadecimal string representation of the binary encoding
 * @throws {Error} When trait type or value IDs are undefined
 */
function getAttrsRawFromTraitsString(traitsString, traitsTypeNameToIdMap, traitsValuesNameToIdMap) {
    const traits = traitsString.split(",");
    let attrsRaw = 0;
    traits.forEach((trait) => {
        const [traitTypeName, traitValueName] = trait.split(":");
        const traitTypeId = traitsTypeNameToIdMap.get(traitTypeName);
        const traitValueId = traitsValuesNameToIdMap.get(`${traitTypeName}:${traitValueName}`);
        if (
            traitTypeId === undefined ||
            traitValueId === undefined
        ) {
            throw new Error(`Invalid trait data: traitTypeId=${traitTypeId} (${typeof traitTypeId}), traitValueId=${traitValueId} (${typeof traitValueId}) for trait ${traitTypeName}:${traitValueName}`);
        }
        
        // Bit shift the trait value ID to the appropriate position
        // Each trait type gets 8 bits, so type N uses bits N*8 to (N*8)+7
        attrsRaw |= traitValueId << (8 * traitTypeId);
    });
    return "0x" + attrsRaw.toString(16);
}

/**
 * Beautiful logging function to display processed NFT data in a structured format.
 * 
 * This function creates a visually appealing display of all processed data including
 * collection metadata, trait type mappings, trait value mappings, and IPFS CID mappings.
 * It uses console formatting and structured display to make the data easy to read and verify.
 * 
 * @param {Object} data - The processed data object returned by processData
 * @param {string} fileName - Original input file name for context
 * @param {boolean} onlyProcessOverwriten - Whether only overwrite items were processed
 */
function logProcessedData(data, fileName, onlyProcessOverwriten) {
    const { name, symbol, updateContractAddress, setDefaultIpfsCidCalldata, setTraitTypesNameCalldata, setTraitValueNameCalldata, setAttrsRawToIPFSCIDCalldata } = data;
    
    if (updateContractAddress) {
        console.log('\n🔄 UPDATE MODE DETECTED:');
        console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
        console.log(`│ Contract Address: ${updateContractAddress.padEnd(58)} │`);
        console.log(`│ Process Mode:    ${'Overwrite Only'.padEnd(58)} │`);
        console.log('└─────────────────────────────────────────────────────────────────────────────┘');
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎨  NFT TRAITS DATA PROCESSING COMPLETE  🎨');
    console.log('='.repeat(80));
    
    // Collection Information
    console.log('\n📋 COLLECTION INFORMATION:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
    console.log(`│ Source File:     ${fileName.padEnd(58)} │`);
    console.log(`│ Collection Name: ${name.padEnd(58)} │`);
    console.log(`│ Symbol:          ${symbol.padEnd(58)} │`);
    console.log('└─────────────────────────────────────────────────────────────────────────────┘');
    

    // Default IPFS CID Summary
    console.log('\n🎯 DEFAULT IPFS CID:');
    console.log(`   Default IPFS CID updated: ${setDefaultIpfsCidCalldata.length}`);
    if (setDefaultIpfsCidCalldata.length > 0) {
        console.log('   ┌──────────────────────────────────────────────────────────────┬───────────┐');
        console.log('   │ Default IPFS CID                                            │ Overwrite │');
        console.log('   ├──────────────────────────────────────────────────────────────┼───────────┤');
        setDefaultIpfsCidCalldata.forEach(([byteArrayCid, overwrite]) => {
            const cidStr = byteArray.stringFromByteArray(byteArrayCid);
            console.log(`    ${cidStr.padEnd(55)} │ ${overwrite ? '✓' : '✗'} ${overwrite ? '       ' : '       '}`);
        });
        console.log('   └──────────────────────────────────────────────────────────────┴───────────┘');
    }

    // Trait Types Summary
    console.log('\n🏷️  TRAIT TYPES CALLDATA:');
    console.log(`   Total trait types updated: ${setTraitTypesNameCalldata.length}`);
    if (setTraitTypesNameCalldata.length > 0) {
        console.log('   ┌─────┬─────────────────────────────────────────────────────────┬───────────┐');
        console.log('   │ ID  │ Name                                                    │ Overwrite │');
        console.log('   ├─────┼─────────────────────────────────────────────────────────┼───────────┤');
        setTraitTypesNameCalldata.forEach(([typeId, byteArrayName, overwrite]) => {
            // Convert byte array back to string for display
            const nameStr = byteArray.stringFromByteArray(byteArrayName);
            console.log(`   │ ${typeId.toString().padStart(3)} │ ${nameStr.padEnd(55)} │ ${overwrite ? '✓' : '✗'} ${overwrite ? '       ' : '       '} │`);
        });
        console.log('   └─────┴─────────────────────────────────────────────────────────┴───────────┘');
    }
    
    // Trait Values Summary
    console.log('\n🎯 TRAIT VALUES CALLDATA:');
    console.log(`   Total trait values updated: ${setTraitValueNameCalldata.length}`);
    if (setTraitValueNameCalldata.length > 0) {
        console.log('   ┌─────┬─────┬─────────────────────────────────────────────────────┬───────────┐');
        console.log('   │ TID │ VID │ Name                                                │ Overwrite │');
        console.log('   ├─────┼─────┼─────────────────────────────────────────────────────┼───────────┤');
        setTraitValueNameCalldata.slice(0, 20).forEach(([typeId, valueId, byteArrayName, overwrite]) => {
            const nameStr = byteArray.stringFromByteArray(byteArrayName);
            console.log(`   │ ${typeId.toString().padStart(3)} │ ${valueId.toString().padStart(3)} │ ${nameStr.padEnd(51)} │ ${overwrite ? '✓' : '✗'} ${overwrite ? '       ' : '       '} │`);
        });
        if (setTraitValueNameCalldata.length > 20) {
            console.log(`   │ ... │ ... │ ... (${setTraitValueNameCalldata.length - 20} more entries) ${' '.repeat(25)} │ ...       │`);
        }
        console.log('   └─────┴─────┴─────────────────────────────────────────────────────┴───────────┘');
    }
    
    // Attribute Combinations Summary
    console.log('\n🎨 ATTRIBUTES TO IPFS MAPPINGS:');
    console.log(`   Total combinations updated: ${setAttrsRawToIPFSCIDCalldata.length}`);
    if (setAttrsRawToIPFSCIDCalldata.length > 0) {
        console.log('   ┌──────────────────┬─────────────────────────────────────────────────┬───────────┐');
        console.log('   │ AttrsRaw (Hex)   │ IPFS CID                                        │ Overwrite │');
        console.log('   ├──────────────────┼─────────────────────────────────────────────────┼───────────┤');
        setAttrsRawToIPFSCIDCalldata.slice(0, 15).forEach(([attrsRaw, byteArrayCid, overwrite]) => {
            const cidStr = byteArray.stringFromByteArray(byteArrayCid);
            const attrsStr = attrsRaw.toString().padEnd(16);
            console.log(`   │ ${attrsStr} │ ${cidStr.padEnd(47)} │ ${overwrite ? '✓' : '✗'} ${overwrite ? '       ' : '       '} │`);
        });
        if (setAttrsRawToIPFSCIDCalldata.length > 15) {
            console.log(`   │ ...              │ ... (${setAttrsRawToIPFSCIDCalldata.length - 15} more combinations) ${' '.repeat(17)} │ ...       │`);
        }
        console.log('   └──────────────────┴─────────────────────────────────────────────────┴───────────┘');
    }
    
    // Statistics Summary
    console.log('\n📊 PROCESSING STATISTICS:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
    console.log(`│ Total Trait Types Updated:          ${setTraitTypesNameCalldata.length.toString().padStart(8)} entries              │`);
    console.log(`│ Total Trait Values Updated:         ${setTraitValueNameCalldata.length.toString().padStart(8)} entries              │`);
    console.log(`│ Total Attribute Mappings Updated:   ${setAttrsRawToIPFSCIDCalldata.length.toString().padStart(8)} combinations        │`);
    console.log(`│ Processing Mode:            ${(onlyProcessOverwriten ? 'Overwrite Only' : 'Full Processing').padEnd(24)} │`);
    console.log('└─────────────────────────────────────────────────────────────────────────────┘');
    
    // Success Message
    console.log('\n✅ Data processing completed successfully!');
    console.log('🚀 Ready for StarkNet contract deployment.');
    console.log('\n' + '='.repeat(80) + '\n');
}