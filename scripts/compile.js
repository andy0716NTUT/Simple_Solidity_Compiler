const fs = require("fs");
const https = require("https");
const path = require("path");
const solc = require("solc");

const projectRoot = path.join(__dirname, "..");
const contractsDir = path.join(__dirname, "..", "contracts");
const artifactsDir = path.join(__dirname, "..", "artifacts");
const argv = process.argv.slice(2);

function parseArgs(args) {
  const opts = {
    all: false,
    fileName: null,
    evmVersion: process.env.EVM_VERSION || null,
    solcVersion: process.env.SOLC_VERSION || null,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--all") {
      opts.all = true;
      continue;
    }

    if (arg === "--evm") {
      opts.evmVersion = args[i + 1] || null;
      i += 1;
      continue;
    }

    if (arg.startsWith("--evm=")) {
      opts.evmVersion = arg.split("=")[1] || null;
      continue;
    }

    if (arg === "--solc") {
      opts.solcVersion = args[i + 1] || null;
      i += 1;
      continue;
    }

    if (arg.startsWith("--solc=")) {
      opts.solcVersion = arg.split("=")[1] || null;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/compile.js [file.sol|--all] [--evm <version>] [--solc <version>]");
      console.log("Examples:");
      console.log("  node scripts/compile.js 00_MyState.sol --evm paris");
      console.log("  node scripts/compile.js contracts/00_MyState.sol --evm paris");
      console.log("  node scripts/compile.js --all --evm shanghai");
      console.log("  node scripts/compile.js 00_MyState.sol --solc 0.8.34");
      process.exit(0);
    }

    if (!arg.startsWith("-")) {
      opts.fileName = arg;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (opts.all && opts.fileName) {
    throw new Error("Use either a file name or --all, not both.");
  }

  return opts;
}

async function loadCompiler(solcVersion) {
  if (!solcVersion) {
    return { compiler: solc, compilerLabel: solc.version() };
  }

  let versionTag = solcVersion.startsWith("v")
    ? solcVersion
    : `v${solcVersion}`;

  // loadRemoteVersion expects full build tags, e.g. v0.8.34+commit.80d5c536.
  if (!versionTag.includes("+commit.")) {
    const fullBuild = await resolveSolcBuild(versionTag.replace(/^v/, ""));
    const normalized = fullBuild
      .replace(/^soljson-/, "")
      .replace(/\.js$/, "");
    versionTag = normalized.startsWith("v") ? normalized : `v${normalized}`;
  }

  const compiler = await new Promise((resolve, reject) => {
    solc.loadRemoteVersion(versionTag, (err, specificCompiler) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(specificCompiler);
    });
  });

  return { compiler, compilerLabel: compiler.version() };
}

function resolveSolcBuild(shortVersion) {
  return new Promise((resolve, reject) => {
    https
      .get("https://binaries.soliditylang.org/bin/list.json", (res) => {
        if (res.statusCode !== 200) {
          reject(
            new Error(
              `Cannot resolve solc version ${shortVersion}: HTTP ${res.statusCode}`
            )
          );
          return;
        }

        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            const build = parsed.releases?.[shortVersion];

            if (!build) {
              reject(
                new Error(
                  `Cannot resolve solc version ${shortVersion}. Try a full version like 0.8.34+commit.80d5c536.`
                )
              );
              return;
            }

            resolve(build);
          } catch (err) {
            reject(new Error(`Invalid solc versions response: ${err.message}`));
          }
        });
      })
      .on("error", (err) => {
        reject(new Error(`Cannot resolve solc version: ${err.message}`));
      });
  });
}

function getSources(options) {
  if (options.all) {
    const files = fs
      .readdirSync(contractsDir)
      .filter((file) => file.endsWith(".sol"));

    if (files.length === 0) {
      throw new Error("No .sol files found in contracts directory.");
    }

    const sources = {};
    for (const file of files) {
      const filePath = path.join(contractsDir, file);
      sources[file] = { content: fs.readFileSync(filePath, "utf8") };
    }
    return sources;
  }

  const fileInput = options.fileName || "00_MyState.sol";
  const { contractPath, sourceName } = resolveContractPath(fileInput);

  if (!fs.existsSync(contractPath)) {
    throw new Error(
      `Contract file not found: ${fileInput}. Use a file under contracts/ or --all.`
    );
  }

  return {
    [sourceName]: { content: fs.readFileSync(contractPath, "utf8") },
  };
}

function resolveContractPath(fileInput) {
  const normalizedInput = fileInput.replace(/\\/g, "/");
  const primary = path.resolve(projectRoot, normalizedInput);
  const fallback = path.resolve(contractsDir, normalizedInput);
  const contractPath = fs.existsSync(primary) ? primary : fallback;

  const relFromContracts = path.relative(contractsDir, contractPath);
  const isUnderContracts =
    relFromContracts &&
    !relFromContracts.startsWith("..") &&
    !path.isAbsolute(relFromContracts);

  if (!isUnderContracts) {
    throw new Error(
      `Contract path must be inside contracts/: ${fileInput}`
    );
  }

  if (!contractPath.endsWith(".sol")) {
    throw new Error(`Contract file must end with .sol: ${fileInput}`);
  }

  return {
    contractPath,
    sourceName: relFromContracts.replace(/\\/g, "/"),
  };
}

async function main() {
  const options = parseArgs(argv);
  const sources = getSources(options);
  const { compiler, compilerLabel } = await loadCompiler(options.solcVersion);

  const input = {
    language: "Solidity",
    sources,
    settings: {
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };

  if (options.evmVersion) {
    input.settings.evmVersion = options.evmVersion;
  }

  const output = JSON.parse(compiler.compile(JSON.stringify(input)));

  if (output.errors) {
    const fatalErrors = output.errors.filter((e) => e.severity === "error");
    output.errors.forEach((e) => {
      console.log(`${e.severity.toUpperCase()}: ${e.formattedMessage}`);
    });

    if (fatalErrors.length > 0) {
      process.exit(1);
    }
  }

  // Keep artifacts deterministic by clearing previous outputs before each compile.
  if (fs.existsSync(artifactsDir)) {
    fs.rmSync(artifactsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(artifactsDir, { recursive: true });

  console.log(`Compiler: ${compilerLabel}`);
  console.log(`EVM: ${options.evmVersion || "default"}`);

  for (const fileName of Object.keys(output.contracts || {})) {
    const fileArtifactsDir = path.join(
      artifactsDir,
      path.basename(fileName, ".sol")
    );
    if (!fs.existsSync(fileArtifactsDir)) {
      fs.mkdirSync(fileArtifactsDir, { recursive: true });
    }

    for (const contractName of Object.keys(output.contracts[fileName])) {
      const compiled = output.contracts[fileName][contractName];
      const artifact = {
        contractName,
        sourceName: fileName,
        abi: compiled.abi,
        bytecode: compiled.evm?.bytecode?.object || "",
      };
      const artifactPath = path.join(fileArtifactsDir, `${contractName}.json`);
      fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), "utf8");

      console.log(`Compiled: ${fileName} -> ${contractName}`);
      console.log(`Artifact: ${artifactPath}`);
    }
  }
}

main().catch((err) => {
  console.error(`Compile failed: ${err.message}`);
  process.exit(1);
});
