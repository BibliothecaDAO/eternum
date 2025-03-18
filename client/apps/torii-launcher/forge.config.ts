import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

const config: ForgeConfig = {
  packagerConfig: {
    asar: false,
    icon: "public/icon",
  },
  rebuildConfig: {},
  publishers: [
    {
      name: "@electron-forge/publisher-s3",
      config: {
        bucket: "eternum-torii-updates",
        public: true,
      },
    },
  ],
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {},
    },
    // {
    //   name: "@electron-forge/maker-zip",
    //   config: (arch: string) => ({
    //     // Note that we must provide this S3 URL here
    //     // in order to support smooth version transitions
    //     // especially when using a CDN to front your updates
    //     macUpdateManifestBaseUrl: `http://s3.us-east-1.amazonaws.com/eternum-torii-updates/darwin/${arch}`,
    //   }),
    // },

    // new MakerRpm({}),
    // new MakerDeb({}),
    // {
    //   name: "@electron-forge/maker-dmg",
    //   config: {
    //     background: "./public/icon.png",
    //     format: "ULFO",
    //     icon: "./public/icon.png",
    //     name: "Eternum Launcher",
    //   },
    // },
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: "src/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
};

export default config;
