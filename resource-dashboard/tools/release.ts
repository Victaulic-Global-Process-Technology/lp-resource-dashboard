import { execSync } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';

// ---- Configuration ----
const RELEASE_REPO_RELATIVE = '../Release';
const BUILD_DIR = 'dist'; // Vite output

// ---- Resolve paths ----
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RELEASE_REPO = path.resolve(ROOT, RELEASE_REPO_RELATIVE);
const HISTORY_DIR = path.join(RELEASE_REPO, 'history');
const LATEST_DIR = path.join(RELEASE_REPO, 'latest');
const PKG_PATH = path.join(ROOT, 'package.json');

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function run(cmd: string, cwd: string = ROOT): void {
  execSync(cmd, { cwd, encoding: 'utf-8', stdio: 'inherit' });
}

function runSilent(cmd: string, cwd: string = ROOT): string {
  return execSync(cmd, { cwd, encoding: 'utf-8' }).toString().trim();
}

function hasUncommittedChanges(cwd: string = ROOT): boolean {
  const status = runSilent('git status --porcelain', cwd);
  const tracked = status.split('\n').filter((l) => l && !l.startsWith('??'));
  return tracked.length > 0;
}

async function main() {
  console.log('\n=== Release Script ===\n');

  // Step 1: Check for uncommitted changes
  if (hasUncommittedChanges()) {
    console.log('You have uncommitted changes in the source repo.');
    const msg = await ask('Enter commit message (or Ctrl+C to cancel): ');
    if (msg) {
      run('git add -A');
      run(`git commit -m "${msg}"`);
      console.log('Changes committed.\n');
    }
  }

  // Step 2: Read version
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));
  let version: string = pkg.version;
  console.log(`Current version: ${version}`);

  // Step 3: Check for duplicate version
  const versionDir = path.join(HISTORY_DIR, `v${version}`);
  if (fs.existsSync(versionDir)) {
    console.log(`\nVersion ${version} already exists in release history.`);
    const input = await ask('Enter new version (X.Y.Z) or press Enter to overwrite: ');

    if (input) {
      if (!/^\d+\.\d+\.\d+$/.test(input)) {
        console.error(`Invalid version format: "${input}". Expected X.Y.Z`);
        process.exit(1);
      }
      version = input;
      pkg.version = version;
      fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`Updated package.json to version ${version}`);
    } else {
      console.log(`Overwriting version ${version}...`);
    }
  }

  // Step 4: Build
  console.log('\nBuilding project...');
  run('npm run build');

  const buildOutput = path.join(ROOT, BUILD_DIR);
  if (!fs.existsSync(buildOutput)) {
    console.error(`Build output not found at ${buildOutput}`);
    process.exit(1);
  }

  // Step 5: Deploy to release repo
  console.log('\nDeploying to release repo...');

  fs.ensureDirSync(LATEST_DIR);
  fs.emptyDirSync(LATEST_DIR);
  fs.copySync(buildOutput, LATEST_DIR);
  console.log('  Copied build to latest/');

  fs.ensureDirSync(HISTORY_DIR);
  const historyVersionDir = path.join(HISTORY_DIR, `v${version}`);
  if (fs.existsSync(historyVersionDir)) {
    fs.removeSync(historyVersionDir);
  }
  fs.copySync(buildOutput, historyVersionDir);
  console.log(`  Copied build to history/v${version}/`);

  // Step 6: Commit and push source repo
  if (hasUncommittedChanges()) {
    run('git add -A');
    run(`git commit -m "v${version}: release"`);
  }
  run('git push');
  console.log('Source repo pushed.');

  console.log(`\n=== Released v${version} successfully ===\n`);
}

main().catch((err) => {
  console.error('Release failed:', err);
  process.exit(1);
});
