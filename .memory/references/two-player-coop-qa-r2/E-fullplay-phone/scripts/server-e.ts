import { createBeerCrusherServer } from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/server/wsServer';
import path from 'node:path';

const dataDir = process.argv[2] || path.resolve(__dirname, '../data');
const storePath = path.join(dataDir, 'players.json');
createBeerCrusherServer({ port: 8805, storePath }).then((s) => {
  console.log('QA-E Game Server listening on port', s.port);
});
