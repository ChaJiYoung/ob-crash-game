import path from 'node:path';
import { createBeerCrusherServer } from '../server/wsServer';

const dataDir = process.argv[2] || path.resolve('.memory/references/two-player-coop-qa/B-mouse-phone/data');
createBeerCrusherServer({
  port: 8802,
  storePath: path.join(dataDir, 'players.json'),
}).then((s) => {
  console.log(`[QA-B] Game capserver listening on port ${s.port}, dataDir=${dataDir}`);
});
