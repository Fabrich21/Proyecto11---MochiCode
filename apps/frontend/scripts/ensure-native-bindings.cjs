const { platform, arch } = process;

if (platform !== 'linux' || arch !== 'x64') {
  process.exit(0);
}

const { execSync } = require('child_process');

const packages = [
  '@tailwindcss/oxide-linux-x64-gnu@4.3.0',
  'lightningcss-linux-x64-gnu@1.32.0',
];

for (const pkg of packages) {
  const baseName = pkg.split('@').length > 2 ? `@${pkg.split('@')[1]}` : pkg.split('@')[0];

  try {
    require.resolve(baseName);
  } catch {
    execSync(`npm install --no-save --force ${pkg}`, {
      stdio: 'inherit',
    });
  }
}
