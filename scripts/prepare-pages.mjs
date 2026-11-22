import { copyFile, cp, mkdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'tour.js', 'tour.css', 'leaderboard.js']) {
  await copyFile(new URL(file, root), new URL(file, output));
}
await cp(new URL('assets/', root), new URL('assets/', output), { recursive: true });
await writeFile(new URL('_routes.json', output), JSON.stringify({
  version: 1,
  include: ['/api/leaderboard'],
  exclude: [],
}));
