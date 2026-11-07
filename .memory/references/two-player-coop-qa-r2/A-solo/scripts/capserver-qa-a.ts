import { createBeerCrusherServer } from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/server/wsServer';
import path from 'node:path';

const defaultDir = '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa-r2/A-solo/data';
const storePath = path.join(process.argv[2] || defaultDir, 'players.json');
createBeerCrusherServer({ port: 8801, storePath }).then((s) => console.log('capserver QA-A up on', s.port));
