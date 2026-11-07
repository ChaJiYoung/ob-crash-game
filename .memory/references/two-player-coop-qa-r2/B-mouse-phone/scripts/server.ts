import { createBeerCrusherServer } from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/server/wsServer';
import path from 'node:path';

const dataDir = process.argv[2] || path.resolve('.memory/references/two-player-coop-qa-r2/B-mouse-phone/data');
const storePath = path.join(dataDir, 'players.json');
const recordPath = path.join(dataDir, 'play-records.jsonl');

createBeerCrusherServer({
  port: 8802,
  storePath,
  recordPath,
}).then((s) => {
  console.log(`[QA-B] Game server running on port ${s.port}, store: ${storePath}, records: ${recordPath}`);
});
