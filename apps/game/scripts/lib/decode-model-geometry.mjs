import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco from "draco3dgltf";

let decoder;
/** Decode delivery geometry for checks that inspect raw accessors; retain textures and the complete skin. */
export async function decodeModelGeometry(bytes) {
  decoder ??= draco.createDecoderModule();
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "draco3d.decoder": await decoder });
  const document = await io.readBinary(bytes);
  for (const extension of document.getRoot().listExtensionsUsed()) {
    if (extension.extensionName === "KHR_draco_mesh_compression") extension.dispose();
  }
  return Buffer.from(await io.writeBinary(document));
}
