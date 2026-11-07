import { createBeerCrusherServer } from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/server/wsServer';

const dataDir = process.argv[2] || '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa-r2/D-fullplay-mouse/data';
const storePath = dataDir + '/players.json';

createBeerCrusherServer({ port: 8804, storePath }).then((s) => {
  console.log('capserver QA-D up on port', s.port);
});
