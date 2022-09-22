import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { web3 } from "@project-serum/anchor";
import { Solplace } from "../target/types/solplace";
import { assert } from "chai"
import { BN } from "bn.js";

describe("solplace", () => {
  // Configure the client to use the local cluster.
  const anchorProvider = anchor.AnchorProvider.env();
  anchor.setProvider(anchorProvider);

  const program = anchor.workspace.Solplace as Program<Solplace>;

  let costumerKeypair = new web3.Keypair();
  let costumerWallet = new anchor.Wallet(costumerKeypair);

  it("Can init vault", async () => {
  
    const [vaultPublicKey] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId,
    )
  
    await program.methods
      .initVault()
      .accounts({
        vault: vaultPublicKey,
        user: anchorProvider.wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc()
  
    const storedVault = await program.account.vault.fetch(vaultPublicKey)
    assert.equal(storedVault.owner.toString(), anchorProvider.wallet.publicKey.toString())
  });

  it("Can create a pixel", async () => {

    const [vaultPublicKey] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId,
    )

    const x = 10
    const y = 10
  
    const [pixelPublicKey] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("pixel"), Buffer.from([x, y])],
      program.programId,
    )

    await program.methods
      .createPixel(x, y, 0, 0, 255, new BN(1), new BN(10))
      .accounts({
        pixel: pixelPublicKey,
        user: anchorProvider.wallet.publicKey,
        vault: vaultPublicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc()
  

    let current_slot = await anchorProvider.connection.getSlot();

    const storedPixel = await program.account.pixel.fetch(pixelPublicKey)
    assert.equal(storedPixel.posX, x)
    assert.equal(storedPixel.posY, y)
    assert.equal(storedPixel.colR, 0)
    assert.equal(storedPixel.colG, 0)
    assert.equal(storedPixel.colB, 255)
    assert.equal(storedPixel.lamportPerSlot.toString(), new BN(1).toString())
    assert.equal(storedPixel.lastSlot.toString(), new BN(current_slot + 10).toString())
    assert.equal(storedPixel.bidder.toString(), anchorProvider.wallet.publicKey.toString())
  });

  it("Does not allow creating the same pixel twice", async () => {
    const [vaultPublicKey] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId,
    )

    const x = 20
    const y = 20
  
    const [pixelPublicKey] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("pixel"), Buffer.from([x, y])],
      program.programId,
    )

    await program.methods
      .createPixel(x, y, 0, 0, 255, new BN(1), new BN(10))
      .accounts({
        pixel: pixelPublicKey,
        user: anchorProvider.wallet.publicKey,
        vault: vaultPublicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc()

    await program.methods
      .createPixel(x, y, 0, 0, 255, new BN(1), new BN(10))
      .accounts({
        pixel: pixelPublicKey,
        user: anchorProvider.wallet.publicKey,
        vault: vaultPublicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .postInstructions([
        // make the transaction unique
        web3.SystemProgram.transfer({
          fromPubkey: anchorProvider.wallet.publicKey,
          toPubkey: anchorProvider.wallet.publicKey,
          lamports: 1,
        })
      ])
      .rpc()
      .then(
        () => Promise.reject(new Error('Expected to error!')),
        (e: web3.SendTransactionError) => {
          // Log is eg. 'Allocate: account Address { address: 6V4qyzgQ9zdDrjiP74hoaece98gLcRt874JFqTsexrQd, base: None } already in use'
          assert.ok(e.logs.some(log => log.includes(pixelPublicKey.toBase58()) && log.includes('already in use')))
        }
      )
  })

  it("Does not allow passing an incorrect address", async () => {

    const [vaultPublicKey] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId,
    )

    // Generate the PDA for (0, 0)
    const [pixelPublicKey] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("pixel"), Buffer.from([0, 0])],
      program.programId,
    )
  
    // Attempt to use it to create (30, 30)
    await program.methods
      .createPixel(30, 30, 0, 0, 255, new BN(1), new BN(10))
      .accounts({
        pixel: pixelPublicKey,
        user: anchorProvider.wallet.publicKey,
        vault: vaultPublicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc()
      .then(
        () => Promise.reject(new Error('Expected to error!')),
        (e: web3.SendTransactionError) => {
          // Log is eg. '5NbE1G4B95BMHrz94jLk3Q1GivRgh9Eyj8mtHss3sVZA's signer privilege escalated'
          const expectedError = `${pixelPublicKey.toBase58()}'s signer privilege escalated`
          assert.ok(e.logs.some(log => log === expectedError))
        }
      )
  })

  it("Can update a created pixel", async () => {

    const [vaultPublicKey] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId,
    )

    const x = 40
    const y = 40
  
    const [pixelPublicKey] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("pixel"), Buffer.from([x, y])],
      program.programId,
    )
  
    // Create the pixel
    await program.methods
      .createPixel(x, y, 0, 0, 255, new BN(1), new BN(10))
      .accounts({
        pixel: pixelPublicKey,
        user: anchorProvider.wallet.publicKey,
        vault: vaultPublicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc()

    let storedPixel = await program.account.pixel.fetch(pixelPublicKey)

    // Update the pixel
    await program.methods
      .updatePixel(255, 0, 0, new BN(2), new BN(10))
      .accounts({
        pixel: pixelPublicKey,
        user: anchorProvider.wallet.publicKey,
        vault: vaultPublicKey,
        bidder: storedPixel.bidder,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc()

    let current_slot = await anchorProvider.connection.getSlot();
  
    storedPixel = await program.account.pixel.fetch(pixelPublicKey)
    assert.equal(storedPixel.posX, x)
    assert.equal(storedPixel.posY, y)
    assert.equal(storedPixel.colR, 255)
    assert.equal(storedPixel.colG, 0)
    assert.equal(storedPixel.colB, 0)
    assert.equal(storedPixel.lamportPerSlot.toString(), new BN(2).toString())
    assert.equal(storedPixel.lastSlot.toString(), new BN(current_slot + 10).toString())
    assert.equal(storedPixel.bidder.toString(), anchorProvider.wallet.publicKey.toString())
  })

  it("Does not update a created pixel if the rent is less", async () => {

    const [vaultPublicKey] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId,
    )

    const x = 60
    const y = 60
  
    const [pixelPublicKey] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("pixel"), Buffer.from([x, y])],
      program.programId,
    )
  
    // Create the pixel
    await program.methods
      .createPixel(x, y, 0, 0, 255, new BN(1), new BN(10))
      .accounts({
        pixel: pixelPublicKey,
        user: anchorProvider.wallet.publicKey,
        vault: vaultPublicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc()

    let storedPixel = await program.account.pixel.fetch(pixelPublicKey)

    // Update the pixel
    await program.methods
      .updatePixel(255, 0, 0, new BN(2), new BN(2))
      .accounts({
        pixel: pixelPublicKey,
        user: anchorProvider.wallet.publicKey,
        vault: vaultPublicKey,
        bidder: storedPixel.bidder,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc()
      .then(
        () => Promise.reject(new Error('Expected to error!')),
        (e: web3.SendTransactionError) => {
          
          assert.ok(e.logs.some(log => log.includes('Number Slots X Lamports Per Slot Invalid')))
        }
      )
  })

  it("Emits an event when a pixel is created", async () => {
    let events = [];
    const listener = program.addEventListener('PixelChanged', (event: any) => {
      events.push(event)
    })

    const [vaultPublicKey] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId,
    )
  
    const x = 50
    const y = 50
  
    const [pixelPublicKey] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("pixel"), Buffer.from([x, y])],
      program.programId,
    )
  
    await program.methods
      .createPixel(x, y, 0, 0, 255, new BN(1), new BN(10))
      .accounts({
        pixel: pixelPublicKey,
        user: anchorProvider.wallet.publicKey,
        vault: vaultPublicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc()
  
    assert.equal(events.length, 1)
    const event = events[0];
  
    assert.equal(event.posX, x)
    assert.equal(event.posY, y)
    assert.equal(event.colR, 0)
    assert.equal(event.colG, 0)
    assert.equal(event.colB, 255)

    let current_slot = await anchorProvider.connection.getSlot();
    
    assert.equal(event.posX, x)
    assert.equal(event.posY, y)
    assert.equal(event.colR, 0)
    assert.equal(event.colG, 0)
    assert.equal(event.colB, 255)
    assert.equal(event.lamportPerSlot.toString(), new BN(1).toString())
    assert.equal(event.lastSlot.toString(), new BN(current_slot + 10).toString())
    assert.equal(event.bidder.toString(), anchorProvider.wallet.publicKey.toString())
  
    program.removeEventListener(listener)
  })
  
  it("Emits an event when a pixel is updated", async () => {
    // Update the (50, 50) from the previous test
    let events = [];
    const listener = program.addEventListener('PixelChanged', (event: any) => {
      events.push(event)
    })

    const [vaultPublicKey] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId,
    )
  
    const x = 50
    const y = 50
  
    const [pixelPublicKey] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("pixel"), Buffer.from([x, y])],
      program.programId,
    )

    let storedPixel = await program.account.pixel.fetch(pixelPublicKey)
  
    await program.methods
      .updatePixel(255, 0, 0, new BN(2), new BN(10))
      .accounts({
        pixel: pixelPublicKey,
        user: anchorProvider.wallet.publicKey,
        vault: vaultPublicKey,
        bidder: storedPixel.bidder,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc()
  
    assert.equal(events.length, 1)
    const event = events[0];
  
    assert.equal(event.posX, x)
    assert.equal(event.posY, y)
    assert.equal(event.colR, 255)
    assert.equal(event.colG, 0)
    assert.equal(event.colB, 0)
  
    program.removeEventListener(listener)
  })
});

