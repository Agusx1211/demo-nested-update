import { ethers } from "ethers";
import { Account } from "@0xsequence/account";
import { tracker, trackers } from "@0xsequence/sessions";
import { commons, v2 } from "@0xsequence/core";
import * as signhub from "@0xsequence/signhub";
import { SequenceOrchestratorWrapper } from "@0xsequence/wallet";
import { defaults } from "@0xsequence/migration";

async function newAccount(options: {
  config: v2.config.WalletConfig
  tracker: tracker.ConfigTracker
  contexts: commons.context.VersionedContext
  orchestrator: signhub.SignatureOrchestrator
  networks: any[]
  projectAccessKey?: string
}): Promise<Account> {
  const imageHash = v2.config.ConfigCoder.imageHashOf(options.config)
  const context = options.contexts[2]
  const address = commons.context.addressOf(context, imageHash)

  await options.tracker.saveCounterfactualWallet({
    config: options.config,
    context: Object.values(options.contexts)
  })

  return new Account({
    address,
    tracker: options.tracker as any,
    contexts: options.contexts,
    networks: options.networks,
    orchestrator: options.orchestrator,
    migrations: defaults.DefaultMigrations,
    projectAccessKey: options.projectAccessKey
  })
}

// Create tracker and services
const remoteTracker = new trackers.remote.RemoteConfigTracker("https://sessions.sequence.app");

// Create a new signer
const innerSigner1 = ethers.Wallet.createRandom();
console.log("Created inner signer1:", innerSigner1.address);

// Create a new signer
const innerSigner2 = ethers.Wallet.createRandom();
console.log("Created inner signer2:", innerSigner2.address);

// Create a new sequence account (that will be a signer)
const signer = await newAccount({
  tracker: remoteTracker,
  config: {
    threshold: 3,
    checkpoint: 0,
    version: 2,
    tree: {
      left: {
        weight: 1,
        threshold: 1,
        tree: {
          left: {
            left: {
              // Fake recovery wallet
              address: ethers.Wallet.createRandom().address,
              weight: 1,
            },
            right: {
              // Fake gnosis wallet
              address: ethers.Wallet.createRandom().address,
              weight: 1,
            }
          },
          right: {
            address: innerSigner1.address,
            weight: 1,
          }
        }
      },
      right: {
        weight: 2,
        threshold: 1,
        tree: {
          left: {
            left: {
              // Fake recovery wallet
              address: ethers.Wallet.createRandom().address,
              weight: 1,
            },
            right: {
              // Fake gnosis wallet
              address: ethers.Wallet.createRandom().address,
              weight: 1,
            }
          },
          right: {
            address: innerSigner2.address,
            weight: 1,
          }
        }
      }
    }
  },
  orchestrator: new signhub.Orchestrator([
    innerSigner1,
    innerSigner2
  ]),
  networks: [{
    chainId: 1,
    name: "Ethereum",
    rpcUrl: "https://nodes.sequence.app/mainnet",
    nativeToken: {
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18
    },
    relayer: {
      url: "https://relayer.sequence.app/mainnet",
      provider: new ethers.JsonRpcProvider("https://nodes.sequence.app/mainnet")
    }
  }],
  contexts: commons.context.defaultContexts
})

// Create a new 1/1 wallet using the signer
const wallet = await Account.new({
  tracker: remoteTracker,
  config: {
    threshold: 1,
    checkpoint: 1,
    signers: [{
      address: signer.address,
      weight: 1,
    }],
  },
  orchestrator: new signhub.Orchestrator([
    new SequenceOrchestratorWrapper(
      signer.walletForStatus(1, await signer.status(1))
    )
  ]),
  networks: [{
    chainId: 1,
    name: "Ethereum",
    rpcUrl: "https://nodes.sequence.app/mainnet",
    nativeToken: {
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18
    },
    relayer: {
      url: "https://relayer.sequence.app/mainnet",
      provider: new ethers.JsonRpcProvider("https://nodes.sequence.app/mainnet")
    }
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
const nextConfig = {
  threshold: 1,
  checkpoint: 2,
  version: 2,
  tree: {
    left: {
      address: signer.address,
      weight: 1,
    },
    right: {
      address: signer2.address,
      weight: 1,
    }
  }
}
const nextImageHash = v2.coders.config.imageHashOf(nextConfig)

// sign an update config struct
const updateStruct = v2.coders.signature.hashSetImageHash(nextImageHash)

// sign the update struct, using chain id 0
const signature = await wallet.signDigest(updateStruct, 0, false)

// save the presigned transaction to the sessions tracker
await remoteTracker.savePresignedConfiguration({
  wallet: wallet.address,
  nextConfig,
  signature
})

console.log("Updated config");

// Publish the witness with the new signer
await wallet.publishWitness()
console.log("Published witness");
