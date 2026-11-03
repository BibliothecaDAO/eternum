/** Records actual move submissions and their receipts without retaining signatures or account addresses. */
export function watchReleaseMove(devTools) {
  const sends = new Map();
  const reads = [];
  const stop = devTools.onEvent(({ method, params }) => {
    if (method === "Network.requestWillBeSent") {
      let call;
      try {
        call = JSON.parse(params.request?.postData || "null");
      } catch {
        return;
      }
      if (call?.method !== "starknet_addInvokeTransaction") return;
      const transaction = call.params.invoke_transaction ?? call.params[0];
      sends.set(params.requestId, {
        url: params.request.url,
        account: transaction.sender_address,
        nonce: transaction.nonce,
      });
    }
    if (method === "Network.loadingFinished" && sends.has(params.requestId)) {
      const send = sends.get(params.requestId);
      reads.push(
        devTools
          .send("Network.getResponseBody", { requestId: params.requestId })
          .then(({ body, base64Encoded }) => {
            send.reply = JSON.parse(base64Encoded ? Buffer.from(body, "base64").toString() : body);
          })
          .catch(() => {
            send.unreadable = true;
          }),
      );
    }
  });
  let nonceBefore;
  return {
    stop,
    before: async () => {
      const first = [...sends.values()][0];
      if (!first) throw new Error("No signed move was observed before the release");
      nonceBefore = await nonce(first);
    },
    measure: async () => {
      await Promise.all(reads);
      const first = [...sends.values()][0];
      const attempts = await Promise.all([...sends.values()].map(describeAttempt));
      const nonceAfter = await nonce(first);
      return { nonceBefore, nonceAfter, nonceSpent: (BigInt(nonceAfter) - BigInt(nonceBefore)).toString(), attempts };
    },
  };
}

const nonce = ({ url, account }) => rpc(url, "starknet_getNonce", { block_id: "latest", contract_address: account });

async function describeAttempt(send) {
  const error = send.reply?.error;
  if (error)
    return {
      nonce: send.nonce,
      rpcErrorCode: error.code,
      staleRelease: /stale release/i.test(JSON.stringify(error)),
      included: error.code === 55 ? false : null,
      actualFee: error.code === 55 ? "0" : null,
    };
  const transactionHash = send.reply?.result?.transaction_hash;
  if (!transactionHash) return { nonce: send.nonce, unreadable: true };
  const receipt = await rpc(send.url, "starknet_getTransactionReceipt", { transaction_hash: transactionHash });
  return {
    nonce: send.nonce,
    transactionHash,
    included: true,
    execution: receipt.execution_status,
    staleRelease: /stale release/i.test(receipt.revert_reason ?? ""),
    actualFee: receipt.actual_fee.amount,
    feeUnit: receipt.actual_fee.unit,
  };
}

async function rpc(url, method, params) {
  const response = await fetch(url, {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`Release measurement RPC HTTP ${response.status}`);
  const answer = await response.json();
  if (answer.error) throw new Error(`Release measurement RPC error ${answer.error.code}`);
  return answer.result;
}
