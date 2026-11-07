import { createBeerCrusherServer } from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/server/wsServer';

const dataDir = process.argv[2] || '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa/C-phone-phone/data';
createBeerCrusherServer({ port: 8803, storePath: dataDir + '/players.json' }).then((s) => {
  console.log('capserver-C up on port', s.port);
});
