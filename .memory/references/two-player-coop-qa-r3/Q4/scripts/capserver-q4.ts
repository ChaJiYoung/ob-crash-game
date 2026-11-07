import { createBeerCrusherServer } from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/server/wsServer';

const dataDir = process.argv[2] || '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa-r3/Q4/data';
const storePath = dataDir + '/players.json';

createBeerCrusherServer({ port: 8824, storePath }).then((s) => {
  console.log('capserver Q4 up on port', s.port);
});
