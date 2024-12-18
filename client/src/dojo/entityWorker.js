import { debounce } from "lodash";

let entityBatch = {};
let logging = false;
const DEBOUNCE_DELAY = 1000;

let debouncedSendBatch = debounce(() => {
  if (Object.keys(entityBatch).length > 0) {
    console.log("Worker: Sending batch", entityBatch);
    self.postMessage({ updatedEntities: entityBatch });
    entityBatch = {};
  }
}, DEBOUNCE_DELAY);

self.onmessage = async (e) => {
  const { type, entities, logging: logFlag } = e.data;
  if (type === "update") {
    logging = logFlag;
    if (logging) console.log("Worker: Received entities update");
    handleUpdate(entities.fetchedEntities, entities.data);
  }
};

function handleUpdate(fetchedEntities, data) {
  entityBatch[fetchedEntities] = {
    ...entityBatch[fetchedEntities],
    ...data,
  };
  debouncedSendBatch();
}
