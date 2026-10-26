const archiver = require("archiver");
const path = require("node:path");
const fs = require("node:fs");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const packName = manifest.header.name.replace(/\s+/g, "_");
const version = manifest.header.version;
const outputPath = path.join(root, `${packName}_v${version}.mcpack`);
const archive = archiver("zip", { zlib: { level: 9 } });
const output = fs.createWriteStream(outputPath);

// ensure we have a clean build
const exclude = [
    "bin",
    "node_modules",
    "src",
    "package-lock.json",
    "package.json",
    "tsconfig.json",
    "README.md"
];
const isExcluded = (entry) => 
    entry.startsWith(".") || exclude.includes(entry) || entry.endsWith(".mcpack");

fs.readdirSync(root)
    .filter((f) => f.endsWith(".mcpack"))
    .forEach((f) => fs.unlinkSync(path.join(root, f)));

output.on("close", () => {
    const size = (archive.pointer() / 1024).toFixed(1);
    console.log(`\nPacked: ${path.basename(outputPath)} (${size} KB)`);
});

output.on("error", (err) => {
    console.error(`Failed writing ${path.basename(outputPath)}: ${err.message}`);
    process.exit(1);
});

archive.on("warning", (err) => {
    if (err.code !== "ENOENT") throw err;
    console.warn("Warning:", err.message);
});

archive.on("error", (err) => { throw err; });

archive.pipe(output);

for (const entry of fs.readdirSync(root)) {
    if (isExcluded(entry)) continue;
    const fullPath = path.join(root, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
        archive.directory(fullPath, entry);
    } else {
        archive.file(fullPath, { name: entry });
    };
};

archive.finalize();