/**
 * MockDoot.ts - Mock Doot Oracle for testing
 *
 * Provides a testable version of Doot with methods to set prices
 */

import {
  SmartContract,
  Field,
  method,
  State,
  state,
  PublicKey,
  Experimental,
  Permissions,
} from 'o1js';

const { OffchainState } = Experimental;

import {
  IpfsCID,
  TokenInformationArray,
  TokenInformationArrayProof,
  dootOffchainState,
} from './DootOracle.js';

/**
 * MockDoot - Testable version of Doot Oracle
 *
 * Adds methods to set prices for testing purposes
 */
export class MockDoot extends SmartContract {
  @state(Field) commitment = State<Field>();
  @state(IpfsCID) ipfsCID = State<IpfsCID>();
  @state(PublicKey) owner = State<PublicKey>();
  @state(OffchainState.Commitments) offchainStateCommitments =
    dootOffchainState.emptyCommitments();

  offchainState = dootOffchainState.init(this);

  async deploy() {
    await super.deploy();
    this.account.permissions.set({
      ...Permissions.default(),
      setPermissions: Permissions.impossible(),
      access: Permissions.proof(),
    });
  }

  /**
   * Initialize mock Doot with initial prices
   */
  @method
  async initBase(prices: TokenInformationArray) {
    // Ensure offchain state has contract instance
    this.offchainState.setContractInstance(this);
    // Verify first initialization
    this.owner.getAndRequireEquals().assertEquals(PublicKey.empty());

    // Set caller as owner
    const sender = this.sender.getAndRequireSignature();
    this.owner.set(sender);

    // Initialize prices in offchain state
    const currentPrices = await this.offchainState.fields.tokenInformation.get(Field(0));
    this.offchainState.fields.tokenInformation.update(Field(0), {
      from: currentPrices,
      to: prices,
    });

    // Set dummy commitment
    this.commitment.set(Field(0));
  }

  /**
   * Update prices (owner only)
   */
  @method
  async updatePrices(prices: TokenInformationArray) {
    this.offchainState.setContractInstance(this);
    // Verify owner
    const owner = this.owner.getAndRequireEquals();
    const sender = this.sender.getAndRequireSignature();
    sender.assertEquals(owner);

    // Update prices
    const currentPrices = await this.offchainState.fields.tokenInformation.get(Field(0));
    this.offchainState.fields.tokenInformation.update(Field(0), {
      from: currentPrices,
      to: prices,
    });
  }

  /**
   * Get current prices from Doot Oracle
   */
  @method.returns(TokenInformationArray)
  async getPrices(): Promise<TokenInformationArray> {
    this.offchainState.setContractInstance(this);
    const info = await this.offchainState.fields.tokenInformation.get(Field(0));
    return info.value;
  }

  /**
   * Settle offchain state
   */
  @method
  async settle(proof: TokenInformationArrayProof) {
    this.offchainState.setContractInstance(this);
    await this.offchainState.settle(proof);
  }
}
