import { useDojo } from "@bibliothecadao/react";
import { CheckCircle2, ChevronLeft, Download, Factory, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { byteArray, shortString } from "starknet";
import { env } from "../../../../../env";
import { getManifestJsonString, type ChainType } from "../utils/manifest-loader";

type TxState = { status: "idle" | "running" | "success" | "error"; hash?: string; error?: string };

// Factory addresses by chain
const FACTORY_ADDRESSES: Record<ChainType, string> = {
  sepolia: "0x6041380026a8e033c39da1d97e27e9650de03c9d1673f3d0212378892e3b95b",
  local: "",
  mainnet: "",
  slot: "",
  slottest: "",
};

// Helper to parse manifest and generate factory config
interface ManifestContract {
  class_hash: string;
  tag: string;
  selector: string;
  init_calldata?: any[];
}

interface ManifestModel {
  class_hash: string;
  tag: string;
}

interface ManifestEvent {
  class_hash: string;
  tag: string;
}

interface ManifestData {
  world: {
    class_hash: string;
    seed: string;
  };
  contracts: ManifestContract[];
  models: ManifestModel[];
  events: ManifestEvent[];
}

// Generate factory config calldata from manifest
const generateFactoryCalldata = (
  manifest: ManifestData,
  version: string,
  namespace: string,
  maxActions: number = 20,
  defaultNamespaceWriterAll: boolean = true
): any[] => {
  const calldata: any[] = [];

  // Version (felt252)
  calldata.push(version);

  // Max actions (u64)
  calldata.push(maxActions);

  // World class hash
  calldata.push(manifest.world.class_hash);

  // Default namespace (as ByteArray)
  const namespaceByteArray = byteArray.byteArrayFromString(namespace);
  calldata.push(namespaceByteArray);

  // Default namespace writer all (bool)
  calldata.push(defaultNamespaceWriterAll ? 1 : 0);

  // Contracts count
  calldata.push(manifest.contracts.length);

  // Contracts array: selector, class_hash, init_calldata_count, ...init_calldata
  for (const contract of manifest.contracts) {
    calldata.push(contract.selector);
    calldata.push(contract.class_hash);
    const initCalldataCount = contract.init_calldata?.length || 0;
    calldata.push(initCalldataCount);
    if (initCalldataCount > 0) {
      calldata.push(...(contract.init_calldata || []));
    }
    calldata.push(0); // writer of resources
    calldata.push(0); // owner of resources
  }

  // Models count
  calldata.push(manifest.models.length);

  // Models array: class_hash
  for (const model of manifest.models) {
    calldata.push(model.class_hash);
  }

  // Events count
  calldata.push(manifest.events.length);

  // Events array: class_hash
  for (const event of manifest.events) {
    calldata.push(event.class_hash);
  }

  return calldata;
};

// Generate Cairo code output similar to sozo inspect --output-factory
const generateCairoOutput = (manifest: ManifestData, version: string, maxActions: number, defaultNamespaceWriterAll: boolean, namespace: string): string => {
  let output = `let factory_config = FactoryConfig {\n`;
  output += `    version: '${version}',\n`;
  output += `    max_actions: ${maxActions},\n`;
  output += `    world_class_hash: TryInto::<felt252, ClassHash>::try_into(${manifest.world.class_hash}).unwrap(),\n`;
  output += `    default_namespace: "${namespace}",\n`;
  output += `    default_namespace_writer_all: ${defaultNamespaceWriterAll},\n`;
  output += `    contracts: array![\n`;

  for (const contract of manifest.contracts) {
    const initArgsCount = contract.init_calldata?.length || 0;
    output += `        (selector_from_tag!("${contract.tag}"), TryInto::<felt252, ClassHash>::try_into(${contract.class_hash}).unwrap(), array![`;
    if (initArgsCount > 0) {
      output += contract.init_calldata?.join(", ");
    }
    output += `]),\n`;
  }

  output += `    ],\n`;
  output += `    models: array![\n`;

  for (const model of manifest.models) {
    output += `        TryInto::<felt252, ClassHash>::try_into(${model.class_hash}).unwrap(),\n`;
  }

  output += `    ],\n`;
  output += `    events: array![\n`;

  for (const event of manifest.events) {
    output += `        TryInto::<felt252, ClassHash>::try_into(${event.class_hash}).unwrap(),\n`;
  }

  output += `    ],\n`;
  output += `};\n`;

  return output;
};

export const ConfigAdminPage2 = () => {
  const navigate = useNavigate();
  const dojo = useDojo();
  const {
    account: { account },
    setup: { network },
  } = dojo;

  const currentChain = env.VITE_PUBLIC_CHAIN as ChainType;

  const [factoryAddress, setFactoryAddress] = useState<string>("");
  const [version, setVersion] = useState<string>("1");
  const [namespace, setNamespace] = useState<string>("s1_eternum");
  const [worldName, setWorldName] = useState<string>("eternum");
  const [maxActions, setMaxActions] = useState<number>(20);
  const [defaultNamespaceWriterAll, setDefaultNamespaceWriterAll] = useState<boolean>(true);
  const [manifestJson, setManifestJson] = useState<string>("");
  const [parsedManifest, setParsedManifest] = useState<ManifestData | null>(null);
  const [tx, setTx] = useState<TxState>({ status: "idle" });
  const [generatedCalldata, setGeneratedCalldata] = useState<any[]>([]);
  const [showCairoOutput, setShowCairoOutput] = useState<boolean>(false);

  // Auto-load manifest and factory address on mount
  useEffect(() => {
    const defaultFactory = FACTORY_ADDRESSES[currentChain];
    if (defaultFactory) {
      setFactoryAddress(defaultFactory);
    }

    const manifest = getManifestJsonString(currentChain);
    if (manifest) {
      setManifestJson(manifest);
    }
  }, [currentChain]);

  // Auto-parse manifest whenever inputs change
  useEffect(() => {
    if (!manifestJson) return;

    try {
      const parsed = JSON.parse(manifestJson);

      let manifest = parsed;
      if (parsed.configuration?.setup?.manifest) {
        manifest = parsed.configuration.setup.manifest;
      } else if (parsed.manifest) {
        manifest = parsed.manifest;
      }

      if (!manifest.world || !manifest.contracts || !manifest.models || !manifest.events) {
        setParsedManifest(null);
        setGeneratedCalldata([]);
        return;
      }

      setParsedManifest(manifest);
      const calldata = generateFactoryCalldata(manifest, version, namespace, maxActions, defaultNamespaceWriterAll);
      setGeneratedCalldata(calldata);
    } catch {
      setParsedManifest(null);
      setGeneratedCalldata([]);
    }
  }, [manifestJson, version, namespace, maxActions, defaultNamespaceWriterAll]);

  // Load manifest from config files
  const handleLoadFromConfig = (chain: ChainType) => {
    const jsonString = getManifestJsonString(chain);
    if (jsonString) {
      setManifestJson(jsonString);
    }
  };

  // Execute set_config only
  const handleSetConfig = async () => {
    if (!account || !parsedManifest || !factoryAddress) return;

    setTx({ status: "running" });

    try {
      const result = await account.execute({
        contractAddress: factoryAddress,
        entrypoint: "set_config",
        calldata: generatedCalldata,
      });

      setTx({ status: "success", hash: result.transaction_hash });
      await account.waitForTransaction(result.transaction_hash);
    } catch (err: any) {
      setTx({ status: "error", error: err.message });
    }
  };

  // Execute deploy only
  const handleDeploy = async () => {
    if (!account || !factoryAddress || !worldName) return;

    setTx({ status: "running" });

    try {
      const worldNameFelt = shortString.encodeShortString(worldName);
      const result = await account.execute({
        contractAddress: factoryAddress,
        entrypoint: "deploy",
        calldata: [worldNameFelt, version],
      });

      setTx({ status: "success", hash: result.transaction_hash });
      await account.waitForTransaction(result.transaction_hash);
    } catch (err: any) {
      setTx({ status: "error", error: err.message });
    }
  };

  // Execute both set_config and deploy in multicall
  const handleSetConfigAndDeploy = async () => {
    if (!account || !parsedManifest || !factoryAddress || !worldName) return;

    setTx({ status: "running" });

    try {
      const worldNameFelt = shortString.encodeShortString(worldName);
      const result = await account.execute([
        {
          contractAddress: factoryAddress,
          entrypoint: "set_config",
          calldata: generatedCalldata,
        },
        {
          contractAddress: factoryAddress,
          entrypoint: "deploy",
          calldata: [worldNameFelt, version],
        },
      ]);

      setTx({ status: "success", hash: result.transaction_hash });
      await account.waitForTransaction(result.transaction_hash);
    } catch (err: any) {
      setTx({ status: "error", error: err.message });
    }
  };

  const getTxStatusIcon = () => {
    switch (tx.status) {
      case "running":
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getDisabledReason = (action: "configAndDeploy" | "config" | "deploy"): string | null => {
    if (tx.status === "running") return "Transaction in progress";
    if (!account) return "Wallet not connected";
    if (!factoryAddress) return "Factory address required";
    if ((action === "configAndDeploy" || action === "deploy") && !worldName) return "World name required";
    return null;
  };

  return (
    <div className="fixed inset-0 w-full h-full overflow-y-auto overflow-x-hidden bg-gradient-to-br from-slate-200 via-blue-200 to-indigo-200">
      <div className="max-w-6xl mx-auto px-8 py-16">
        {/* Header */}
        <div className="mb-16">
          <button
            onClick={() => navigate("/config-admin")}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors mb-12 group font-medium"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Admin
          </button>

          <div className="space-y-4">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full">
              <Factory className="w-5 h-5 text-white" />
              <span className="text-sm font-semibold text-white uppercase tracking-wide">Factory Deploy</span>
            </div>
            <h1 className="text-6xl font-bold text-slate-900 tracking-tight leading-tight">
              World Contract<br />Deployment
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl leading-relaxed">
              Configure and deploy your Dojo world contracts directly from the browser using the factory pattern
            </p>
          </div>
        </div>

        {/* Execute Actions */}
        {parsedManifest && (
          <div className="mb-12">
            <div className="relative overflow-hidden p-10 bg-white rounded-3xl shadow-xl shadow-indigo-500/10 border border-slate-200">
              <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-full blur-3xl" />
              <div className="relative space-y-8">
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-bold text-slate-900">Ready to Deploy</h3>
                      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100 rounded-full">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Validated</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-slate-600">
                      <span className="font-medium">{parsedManifest.contracts.length} Contracts</span>
                      <span className="font-medium">{parsedManifest.models.length} Models</span>
                      <span className="font-medium">{parsedManifest.events.length} Events</span>
                    </div>
                  </div>
                </div>

                {tx.status === "success" && tx.hash && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <span className="text-sm font-semibold text-emerald-900">Transaction Successful</span>
                      </div>
                      <a
                        href={`https://voyager.online/tx/${tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        View on Explorer →
                      </a>
                    </div>
                  </div>
                )}
                {tx.status === "error" && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <p className="text-sm font-medium text-red-900">{tx.error}</p>
                    </div>
                  </div>
                )}

                {(getDisabledReason("configAndDeploy") || getDisabledReason("config") || getDisabledReason("deploy")) && tx.status !== "running" && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-5 rounded-full bg-amber-400 flex items-center justify-center">
                        <span className="text-xs font-bold text-amber-900">!</span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-amber-900">Action Required</p>
                        <div className="text-xs text-amber-700 space-y-0.5">
                          {getDisabledReason("configAndDeploy") && (
                            <div>• {getDisabledReason("configAndDeploy")}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={handleSetConfigAndDeploy}
                    disabled={!factoryAddress || !account || !worldName || tx.status === "running"}
                    className="col-span-3 lg:col-span-1 px-8 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-2xl transition-all duration-200 flex items-center justify-center gap-3 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5"
                  >
                    {getTxStatusIcon()}
                    <span>{tx.status === "running" ? "Executing..." : "Configure & Deploy"}</span>
                  </button>
                  <button
                    onClick={handleSetConfig}
                    disabled={!factoryAddress || !account || tx.status === "running"}
                    className="px-6 py-5 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:cursor-not-allowed text-slate-700 disabled:text-slate-400 font-semibold rounded-2xl transition-all duration-200"
                  >
                    Configure Only
                  </button>
                  <button
                    onClick={handleDeploy}
                    disabled={!factoryAddress || !account || !worldName || tx.status === "running"}
                    className="px-6 py-5 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:cursor-not-allowed text-slate-700 disabled:text-slate-400 font-semibold rounded-2xl transition-all duration-200"
                  >
                    Deploy Only
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Configuration */}
        <div className="space-y-6 mb-12 p-8 bg-white rounded-3xl shadow-lg border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Configuration</h2>

          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Factory Contract Address</label>
            <input
              type="text"
              value={factoryAddress}
              onChange={(e) => setFactoryAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 hover:border-blue-300 focus:border-blue-500 focus:bg-white rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none transition-all font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">World Name</label>
              <input
                type="text"
                value={worldName}
                onChange={(e) => setWorldName(e.target.value)}
                placeholder="my_world"
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 hover:border-blue-300 focus:border-blue-500 focus:bg-white rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Version</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1"
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 hover:border-blue-300 focus:border-blue-500 focus:bg-white rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Namespace</label>
              <input
                type="text"
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
                placeholder="s1_eternum"
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 hover:border-blue-300 focus:border-blue-500 focus:bg-white rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Max Actions</label>
              <input
                type="number"
                value={maxActions}
                onChange={(e) => setMaxActions(parseInt(e.target.value) || 20)}
                placeholder="20"
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 hover:border-blue-300 focus:border-blue-500 focus:bg-white rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none transition-all"
              />
              <p className="text-xs text-slate-500">Maximum number of actions during deployment (recommended: 20)</p>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Default Namespace Writer</label>
              <div className="flex items-center gap-4 h-[52px]">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={defaultNamespaceWriterAll}
                    onChange={(e) => setDefaultNamespaceWriterAll(e.target.checked)}
                    className="w-5 h-5 rounded border-2 border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-slate-700">Grant write permission to all contracts</span>
                </label>
              </div>
              <p className="text-xs text-slate-500">Recommended if all contracts need to write to models</p>
            </div>
          </div>
        </div>

        {/* Manifest Source */}
        <div className="mb-12 p-8 bg-white rounded-3xl shadow-lg border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-7 h-7 text-white" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-bold text-slate-900">Manifest Loaded</p>
                <p className="text-sm text-slate-600 font-mono">
                  contracts/game/manifest_{currentChain}.json
                </p>
              </div>
            </div>
            <div className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/25">
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                {currentChain}
              </span>
            </div>
          </div>
        </div>

        {/* Summary */}
        {parsedManifest && (
          <div className="space-y-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-slate-900">Deployment Summary</h2>
              <button
                onClick={() => setShowCairoOutput(!showCairoOutput)}
                className="px-6 py-3 text-sm font-semibold text-slate-700 hover:text-white bg-slate-100 hover:bg-gradient-to-r hover:from-blue-600 hover:to-indigo-600 border-2 border-slate-200 hover:border-transparent rounded-2xl transition-all duration-200 uppercase tracking-wide shadow-sm hover:shadow-lg hover:shadow-blue-500/20"
              >
                {showCairoOutput ? "Hide" : "View"} Cairo Code
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="relative overflow-hidden p-8 bg-white border-2 border-slate-200 rounded-3xl space-y-4 hover:shadow-xl hover:border-blue-300 transition-all duration-200">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contracts</div>
                  <div className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {parsedManifest.contracts.length}
                  </div>
                </div>
              </div>
              <div className="relative overflow-hidden p-8 bg-white border-2 border-slate-200 rounded-3xl space-y-4 hover:shadow-xl hover:border-indigo-300 transition-all duration-200">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Models</div>
                  <div className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    {parsedManifest.models.length}
                  </div>
                </div>
              </div>
              <div className="relative overflow-hidden p-8 bg-white border-2 border-slate-200 rounded-3xl space-y-4 hover:shadow-xl hover:border-purple-300 transition-all duration-200">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/5 to-pink-500/5 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Events</div>
                  <div className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    {parsedManifest.events.length}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-white border-2 border-slate-200 rounded-3xl shadow-lg space-y-1">
              <div className="flex items-center justify-between py-5 border-b-2 border-slate-100">
                <span className="text-sm font-bold text-slate-600 uppercase tracking-wide">World Class Hash</span>
                <span className="text-sm text-slate-900 font-mono bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
                  {parsedManifest.world.class_hash.slice(0, 20)}...
                </span>
              </div>
              <div className="flex items-center justify-between py-5 border-b-2 border-slate-100">
                <span className="text-sm font-bold text-slate-600 uppercase tracking-wide">Namespace</span>
                <span className="text-sm font-semibold text-slate-900 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                  {namespace}
                </span>
              </div>
              <div className="flex items-center justify-between py-5">
                <span className="text-sm font-bold text-slate-600 uppercase tracking-wide">Calldata Arguments</span>
                <span className="text-sm font-bold text-slate-900 font-mono bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-200">
                  {generatedCalldata.length}
                </span>
              </div>
            </div>

            {showCairoOutput && (
              <div className="p-8 bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                    <Download className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Generated Cairo Code</p>
                    <p className="text-xs text-slate-400">Factory configuration output</p>
                  </div>
                </div>
                <pre className="text-xs text-emerald-400 overflow-x-auto leading-relaxed font-mono">
                  {generateCairoOutput(parsedManifest, version, maxActions, defaultNamespaceWriterAll, namespace)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-20 pt-8 border-t-2 border-slate-200">
          <div className="flex items-center justify-between p-6 bg-white rounded-2xl border border-slate-200">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Connected Wallet</span>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${account?.address ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <span className="text-sm font-mono text-slate-900">
                  {account?.address ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : "Not connected"}
                </span>
              </div>
            </div>
            <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Network: {currentChain}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
