import { createBeerCrusherServer } from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/server/wsServer';
import path from 'node:path';

const storeDir = '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa-r3/Q1/data';
const storePath = path.join(storeDir, 'players.json');
createBeerCrusherServer({ port: 8821, storePath }).then((s) => console.log('capserver Q1 up on', s.port));
