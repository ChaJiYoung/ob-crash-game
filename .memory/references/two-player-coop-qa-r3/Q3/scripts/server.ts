import { createBeerCrusherServer } from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/server/wsServer';

const dataDir = process.argv[2] || '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa-r3/Q3/data';
createBeerCrusherServer({ port: 8823, storePath: dataDir + '/players.json' }).then((s) => {
  console.log('capserver-R3-Q3 up on port', s.port);
});
