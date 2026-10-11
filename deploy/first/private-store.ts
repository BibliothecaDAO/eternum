import {
  constants,
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, normalize } from "node:path";

/** The owner's directory is the only place this command persists credentials or transaction intents. */
export class PrivateStore {
  readonly directory: string;
  constructor(
    directory: string,
    repository: string,
    readonly writable = false,
  ) {
    if (!isAbsolute(directory)) throw new Error("Use an absolute private directory outside the repository");
    directory = normalize(directory).replace(/\/$/, "") || "/";
    const parent = realpathSync(dirname(directory));
    this.directory = join(parent, directory.split("/").at(-1)!);
    const inside = relative(realpathSync(repository), this.directory);
    if (!inside || (!inside.startsWith("../") && inside !== ".."))
      throw new Error("Private directory cannot be in the repository");
    if (!existsSync(this.directory) && writable) mkdirSync(this.directory, { mode: 0o700 });
    if (existsSync(this.directory)) this.check(this.directory, 0o700, true);
  }
  private check(path: string, mode: number, directory = false) {
    const stat = lstatSync(path);
    if (
      stat.isSymbolicLink() ||
      (directory ? !stat.isDirectory() : !stat.isFile()) ||
      (stat.mode & 0o777) !== mode ||
      stat.uid !== process.getuid?.()
    )
      throw new Error("Private storage must be owner-owned, with directory 0700 and files 0600");
  }
  private path(name: string) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) throw new Error("Invalid private record name");
    return join(this.directory, name);
  }
  read<T>(name: string): T | undefined {
    const path = this.path(name);
    if (!existsSync(path)) return undefined;
    this.check(path, 0o600);
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      return JSON.parse(readFileSync(fd, "utf8"));
    } finally {
      closeSync(fd);
    }
  }
  write(name: string, value: unknown) {
    if (!this.writable) throw new Error("Dry run cannot write private storage");
    const path = this.path(name);
    if (existsSync(path)) this.check(path, 0o600);
    const temporary = this.path(`${name}.${process.pid}.tmp`);
    const fd = openSync(
      temporary,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      writeFileSync(fd, JSON.stringify(value, null, 2) + "\n");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temporary, path);
  }
  lock(): () => void {
    if (!this.writable) throw new Error("Dry run cannot lock private storage");
    const path = this.path("running.json");
    if (existsSync(path)) {
      const previous = this.read<{ pid: number }>("running.json")!;
      try {
        process.kill(previous.pid, 0);
        throw new Error("Another deployment command is running");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
      unlinkSync(path);
    }
    const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    writeFileSync(fd, JSON.stringify({ pid: process.pid }));
    closeSync(fd);
    return () => unlinkSync(path);
  }
}
