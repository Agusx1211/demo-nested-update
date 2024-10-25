import { ethers } from "ethers";
import { Account } from "@0xsequence/account";
import { trackers } from "@0xsequence/sessions";
import { commons, v2 } from "@0xsequence/core";
import * as signhub from "@0xsequence/signhub";

// Create a new signer
const signer = ethers.Wallet.createRandom();
console.log("Created signer:", signer.address);

// Create tracker and services
const tracker = new trackers.remote.RemoteConfigTracker("https://sessions.sequence.app");

// Create a new 1/1 wallet using the signer
const wallet = await Account.new({
  tracker: tracker,
  config: {
    threshold: 1,
    checkpoint: 1,
    signers: [{
      address: signer.address,
      weight: 1,
    }],
  },
  orchestrator: new signhub.Orchestrator([signer]),
  networks: [{
    chainId: 1,
    name: "Ethereum",
    rpcUrl: "https://nodes.sequence.app/mainnet",
    nativeToken: {
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18
    },
  }],
  contexts: commons.context.defaultContexts
})

console.log("Created wallet:", wallet.address);

// Publish the wallet witness
await wallet.publishWitness()
console.log("Published witness");

// Create a second signer
const signer2 = ethers.Wallet.createRandom();
console.log("Created signer2:", signer2.address);

// Update the wallet config
await wallet.updateConfig(v2.config.toWalletConfig({
  threshold: 1,
  checkpoint: 2,
  members: [
    { address: signer.address, weight: 1 },
    { address: signer2.address, weight: 1 },
  ],
}))

console.log("Updated config");

// Publish the witness with the new signer
await wallet.publishWitness()
console.log("Published witness");
