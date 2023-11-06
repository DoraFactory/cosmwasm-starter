import {
  PublishMessageEvent,
  Round,
  SignUpEvent,
  Transaction,
  ProcessProof,
} from "../types";
import { CosmosEvent, CosmosMessage } from "@subql/types-cosmos";

enum RoundStatus {
  Created = "Created",
  Ongoing = "Ongoing",
  Tallying = "Tallying",
  Closed = "Closed",
}

enum PeriodStatus {
  Pending = "Pending",
  Voting = "Voting",
  Processing = "Processing",
  Tallying = "Tallying",
  Ended = "Ended",
}

enum RoundActionType {
  Deploy = "op:deploy",
  SetConfig = "op:settings",
  EnableGS = "op:enableGS",
  DisableGS = "op:disableGS",
  FundGS = "op:fundGS",
  WithdrawGS = "op:withdrawGS",
  SignUp = "signup",
  DeactivateKey = "msg:deactivateKey",
  Vote = "msg:vote",
  Verify = "op:verify",
  Deposit = "deposit",
  NewKey = "msg:newKey",
  StartVoting = "op:kickoff",
  StopVoting = "op:end",
  StartProcessing = "op:startProcessing",
  StopProcessing = "op:stopProcessing",
  StopTallying = "op:stopTallying",
}

enum TxStatus {
  Pending = "Pending",
  Success = "Success",
  Fail = "Fail",
}

export async function handleMessage(msg: CosmosMessage): Promise<void> {
  logger.info("=================== Message =====================");
  logger.info("=================================================");
  logger.info(`Message ${JSON.stringify(msg.msg.decodedMsg)}`);
  logger.info(`height ${JSON.stringify(msg.block.block.header.height)}`);

  let contractAddress = msg.msg.decodedMsg.contract;

  let roundRecord = await Round.get(contractAddress);
  if (roundRecord !== undefined) {
    let type = "";
    let actionName = Object.keys(msg.msg.decodedMsg.msg)[0];
    logger.info(actionName);

    if (actionName === "set_round_info") {
      type = RoundActionType.SetConfig;
    } else if (actionName === "set_whitelists") {
      type = RoundActionType.SetConfig;
    } else if (actionName === "set_vote_options_map") {
      type = RoundActionType.SetConfig;
    } else if (actionName === "start_voting_period") {
      roundRecord.period = PeriodStatus.Voting;
      roundRecord.status = RoundStatus.Ongoing;
      roundRecord.save();
      type = RoundActionType.StartVoting;
    } else if (actionName === "sign_up") {
      roundRecord.period = PeriodStatus.Voting;
      roundRecord.status = RoundStatus.Ongoing;
      roundRecord.save();
      type = RoundActionType.SignUp;
    } else if (actionName === "publish_message") {
      roundRecord.period = PeriodStatus.Voting;
      roundRecord.status = RoundStatus.Ongoing;
      roundRecord.save();
      type = RoundActionType.Vote;
    } else if (actionName === "stop_voting_period") {
      roundRecord.period = PeriodStatus.Processing;
      roundRecord.status = RoundStatus.Tallying;
      roundRecord.save();
      type = RoundActionType.StopVoting;
    } else if (actionName === "start_process_period") {
      roundRecord.period = PeriodStatus.Processing;
      roundRecord.status = RoundStatus.Tallying;
      roundRecord.save();
      type = RoundActionType.StartProcessing;
    } else if (actionName === "process_message") {
      roundRecord.period = PeriodStatus.Processing;
      roundRecord.status = RoundStatus.Tallying;
      roundRecord.save();
      type = RoundActionType.Verify;
    } else if (actionName === "stop_processing_period") {
      roundRecord.period = PeriodStatus.Tallying;
      roundRecord.status = RoundStatus.Tallying;
      roundRecord.save();
      type = RoundActionType.StopProcessing;
    } else if (actionName === "process_tally") {
      roundRecord.period = PeriodStatus.Tallying;
      roundRecord.status = RoundStatus.Tallying;
      roundRecord.save();
      type = RoundActionType.Verify;
    } else if (actionName === "stop_tallying_period") {
      roundRecord.period = PeriodStatus.Ended;
      roundRecord.status = RoundStatus.Closed;
      roundRecord.save();
      type = RoundActionType.StopTallying;
    } else if (actionName === "grant") {
      type = RoundActionType.EnableGS;
    } else if (actionName === "revoke") {
      type = RoundActionType.DisableGS;
    } else if (actionName === "bond") {
      type = RoundActionType.FundGS;
    } else if (actionName === "withdraw") {
      type = RoundActionType.WithdrawGS;
    }

    let blockHeight = BigInt(msg.block.block.header.height);
    let txHash = msg.tx.hash;
    let timestamp = msg.tx.block.header.time.getTime().toString();
    let sender = msg.msg.decodedMsg.sender;
    let txSTatus = TxStatus.Success;
    let fee = msg.tx.tx.events
      .find((event) => event.type === "tx")!
      .attributes.find((attr) => attr.key === "fee")?.value;
    if (fee === undefined) {
      fee = "0peaka";
      txSTatus = TxStatus.Fail;
    }
    let gasUsed = BigInt(msg.tx.tx.gasUsed);
    let gasWanted = BigInt(msg.tx.tx.gasWanted);
    let txRecord = Transaction.create({
      id: txHash,
      blockHeight,
      txHash,
      timestamp,
      type,
      status: txSTatus,
      roundId: roundRecord.roundId,
      circuitName: roundRecord.circuitName,
      fee,
      gasUsed,
      gasWanted,
      caller: sender,
      contractAddress,
    });
    txRecord.save();

    logger.info(`-----------------------------------------------------`);
    logger.info(
      `-------------------- Transaction: ${actionName} --------------------`
    );
    logger.info(`-----------------------------------------------------`);
    logger.info(
      `${blockHeight} Save ${actionName} transaction - ${contractAddress} : ${actionName} ${sender}`
    );
  }
}

export async function handleInstantiateMessage(
  msg: CosmosMessage
): Promise<void> {
  logger.info("=================== Instantiate Message =====================");
  logger.info("=================================================");
  const CircuitMap: Record<string, string> = {
    "0": "MACI-1P1V",
    "1": "MACI-QV",
  };
  let code_id = msg.msg.decodedMsg["codeId"]["low"];
  // if (code_id === 1) {
  if (code_id === 5 || code_id === 14) {
    logger.info(
      "======================== circuit maci qf !!!!! ========================="
    );
    let blockHeight = msg.block.block.header.height;
    let timestamp = msg.tx.block.header.time.getTime().toString();
    let txHash = msg.tx.hash;
    let status = RoundStatus.Created;
    let period = PeriodStatus.Pending;
    let actionType = RoundActionType.Deploy;
    let operator = msg.msg.decodedMsg["sender"];
    let contractAddress = msg.tx.tx.events
      .find((event) => event.type === "instantiate")!
      .attributes.find((attr) => attr.key === "_contract_address")?.value;

    let roundInfo = msg.msg.decodedMsg["msg"]["round_info"];
    let roundTitle = roundInfo["title"];
    let roundDescription = roundInfo["description"];
    let roundLink = roundInfo["link"];

    let votingStart = "0";
    let votingEnd = "0";

    let votingTimeData = msg.msg.decodedMsg["msg"]["voting_time"];
    if (votingTimeData !== null) {
      if (votingTimeData["start_time"] !== null) {
        votingStart = votingTimeData["start_time"];
      }

      if (votingTimeData["end_time"] !== null) {
        votingEnd = votingTimeData["end_time"];
      }
    }

    let coordinatorPubkeyX = msg.msg.decodedMsg["msg"]["coordinator"]["x"];
    let coordinatorPubkeyY = msg.msg.decodedMsg["msg"]["coordinator"]["y"];
    let maxVoteOptions = msg.msg.decodedMsg["msg"]["max_vote_options"];
    let circuitType: string = msg.msg.decodedMsg["msg"]["circuit_type"] || "0";

    let stateTreeDepth =
      msg.msg.decodedMsg["msg"]["parameters"]["state_tree_depth"];
    let intStateTreeDepth =
      msg.msg.decodedMsg["msg"]["parameters"]["int_state_tree_depth"];
    let voteOptionTreeDepth =
      msg.msg.decodedMsg["msg"]["parameters"]["vote_option_tree_depth"];
    let messageBatchSize =
      msg.msg.decodedMsg["msg"]["parameters"]["message_batch_size"];
    let circuitPower = `${stateTreeDepth}-${intStateTreeDepth}-${voteOptionTreeDepth}-${messageBatchSize}`;

    let circuit = `${CircuitMap[circuitType]}_${circuitPower}`;

    let voteOptionMap = JSON.stringify(
      Array.from({ length: Number(maxVoteOptions) }, () => "")
    );

    let results = JSON.stringify([]);
    let allResult = "0";

    let maciDenom = "peaka";
    logger.info(`contractAddress: ${contractAddress}`);
    let allRound = (await store.getByField(`Round`, "maciDenom", maciDenom, {
      limit: 100000,
    })) as unknown as Round[];
    let gasStationEnable = false;
    let totalGrant = "0";
    let baseGrant = "0";
    let totalBond = "0";
    logger.info(`-------- new --------`);
    logger.info(`gasStationEnable: ${gasStationEnable}`);
    logger.info(`totalGrant: ${totalGrant}`);
    logger.info(`baseGrant: ${baseGrant}`);
    logger.info(`totalBond: ${totalBond}`);
    logger.info(`circuitType: ${circuitType}`);
    logger.info(`---------------------`);

    let roundId = (allRound.length + 1).toString();
    const roundRecord = Round.create({
      id: `${contractAddress}`,
      blockHeight: BigInt(blockHeight),
      txHash,
      operator,
      contractAddress: contractAddress!,
      circuitName: circuit,
      timestamp,
      votingStart,
      votingEnd,
      status,
      period,
      actionType,
      roundId,
      roundTitle,
      roundDescription,
      roundLink,
      coordinatorPubkeyX,
      coordinatorPubkeyY,
      voteOptionMap,
      results,
      allResult,
      maciDenom,
      gasStationEnable,
      totalGrant,
      baseGrant,
      totalBond,
      circuitType,
      circuitPower,
    });

    let sender = operator;
    let txSTatus = TxStatus.Success;
    let fee = msg.tx.tx.events
      .find((event) => event.type === "tx")!
      .attributes.find((attr) => attr.key === "fee")?.value;
    if (fee === undefined) {
      fee = "0peaka";
      txSTatus = TxStatus.Fail;
    }
    let gasUsed = BigInt(msg.tx.tx.gasUsed);
    let gasWanted = BigInt(msg.tx.tx.gasWanted);
    let txRecord = Transaction.create({
      id: txHash,
      blockHeight: BigInt(blockHeight),
      txHash: txHash,
      timestamp,
      type: actionType,
      status: txSTatus,
      roundId: roundRecord.roundId,
      circuitName: roundRecord.circuitName,
      fee: fee,
      gasUsed: gasUsed,
      gasWanted: gasWanted,
      caller: sender,
      contractAddress: contractAddress!,
    });
    txRecord.save();

    logger.info(`-----------------------------------------------`);
    logger.info(`-------------------- Round --------------------`);
    logger.info(`-----------------------------------------------`);
    logger.info(
      `${blockHeight} Save round - ${contractAddress} : #${roundId} ${roundDescription}`
    );

    await roundRecord.save();
  }
}

export async function handleEvent(event: CosmosEvent): Promise<void> {
  logger.info("=================== Event =====================");
  logger.info("===============================================");
  logger.info(`handleEvent ${JSON.stringify(event.event.attributes)}`);
  logger.info(`height ${JSON.stringify(event.block.block.header.height)}`);

  let contractAddress = event.event.attributes.find(
    (attr) => attr.key === "_contract_address"
  )?.value!;

  let action_event = event.event.attributes.find(
    (attr) => attr.key === "action"
  )?.value;

  let roundRecord = await Round.get(contractAddress);
  if (roundRecord !== undefined) {
    if (action_event === "sign_up") {
      await handleSignUpEvent(event, contractAddress);
    } else if (action_event === "publish_message") {
      await handlePublishMessageEvent(event, contractAddress);
    } else if (action_event === "set_round_info") {
      await handleSetRoundInfoEvent(event, roundRecord);
    } else if (action_event === "start_voting_period") {
      await handleStartVotingEvent(event, roundRecord);
    } else if (action_event === "stop_voting_period") {
      await handleStopVotingEvent(event, roundRecord);
    } else if (action_event === "process_message") {
      await handleProofEvent(event, contractAddress, "message");
    } else if (action_event === "process_tally") {
      await handleProofEvent(event, contractAddress, "tally");
    } else if (action_event === "set_vote_option") {
      handleSetVoteOption(event, roundRecord);
    } else if (action_event === "stop_tallying_period") {
      handleStopTallyingPeriod(event, roundRecord);
    } else if (action_event === "grant") {
      handleGrant(event, roundRecord);
    } else if (action_event === "revoke") {
      handleRevoke(event, roundRecord);
    } else if (action_event === "bond") {
      handleBond(event, roundRecord);
    } else if (action_event === "withdraw") {
      handleWithdraw(event, roundRecord);
    }
  }
}

export async function handleSignUpEvent(
  event: CosmosEvent,
  contractAddress: string
): Promise<void> {
  let stateIdx = event.event.attributes.find((attr) => attr.key === "state_idx")
    ?.value!;
  let pubKey = event.event.attributes.find((attr) => attr.key === "pubkey")
    ?.value!;
  let balance = event.event.attributes.find((attr) => attr.key === "balance")
    ?.value!;
  let timestamp = event.tx.block.header.time.getTime().toString();

  const eventRecord = SignUpEvent.create({
    id: `${event.tx.hash}-${event.msg.idx}-${event.idx}`,
    blockHeight: BigInt(event.block.block.header.height),
    timestamp,
    txHash: event.tx.hash,
    stateIdx: Number(stateIdx),
    pubKey,
    balance,
    contractAddress,
  });

  await eventRecord.save();
  logger.info(`-----------------------------------------------------`);
  logger.info(`------------------- SignUp Event --------------------`);
  logger.info(`-----------------------------------------------------`);
  logger.info(
    `${eventRecord.blockHeight} Save sign_up event - ${contractAddress} : ${stateIdx} ${pubKey} ${balance}`
  );
}

export async function handlePublishMessageEvent(
  event: CosmosEvent,
  contractAddress: string
): Promise<void> {
  let msgChainLength = event.event.attributes.find(
    (attr) => attr.key === "msg_chain_length"
  )?.value;
  let message = event.event.attributes.find(
    (attr) => attr.key === "message"
  )?.value;
  let enc_pub_key = event.event.attributes.find(
    (attr) => attr.key === "enc_pub_key"
  )?.value;
  if (
    msgChainLength !== undefined &&
    message !== undefined &&
    enc_pub_key !== undefined
  ) {
    let timestamp = event.tx.block.header.time.getTime().toString();
    const eventRecord = PublishMessageEvent.create({
      id: `${event.tx.hash}-${event.msg.idx}-${event.idx}`,
      blockHeight: BigInt(event.block.block.header.height),
      timestamp,
      txHash: event.tx.hash,
      msgChainLength: Number(msgChainLength)!,
      message: message!,
      encPubKey: enc_pub_key!,
      contractAddress: contractAddress,
    });

    await eventRecord.save();

    logger.info(`-----------------------------------------------------`);
    logger.info(`--------------- PublishMessage Event ----------------`);
    logger.info(`-----------------------------------------------------`);
    logger.info(
      `${eventRecord.blockHeight} Save publish_message event - ${contractAddress} : ${msgChainLength} ${message} ${enc_pub_key}`
    );
  }
}

export async function handleSetRoundInfoEvent(
  event: CosmosEvent,
  roundRecord: Round
): Promise<void> {
  let roundTitle = event.event.attributes.find((attr) => attr.key === "title")!
    .value!;
  let roundDescription = event.event.attributes.find(
    (attr) => attr.key === "description"
  )?.value;
  let roundLink = event.event.attributes.find(
    (attr) => attr.key === "link"
  )?.value;

  if (roundDescription === undefined) {
    roundDescription = "";
  }

  if (roundLink === undefined) {
    roundLink = "";
  }

  roundRecord.roundTitle = roundTitle;
  roundRecord.roundDescription = roundDescription;
  roundRecord.roundLink = roundLink;
  roundRecord.save();
}

export async function handleStartVotingEvent(
  event: CosmosEvent,
  roundRecord: Round
): Promise<void> {
  const votingStart = event.event.attributes.find(
    (attr) => attr.key === "start_time"
  )!.value!;
  roundRecord.votingStart = votingStart;
  roundRecord.save();
}

export async function handleStopVotingEvent(
  event: CosmosEvent,
  roundRecord: Round
): Promise<void> {
  const votingEnd = event.event.attributes.find(
    (attr) => attr.key === "end_time"
  )!.value!;
  roundRecord.votingEnd = votingEnd;
  roundRecord.save();
}

export async function handleProofEvent(
  event: CosmosEvent,
  contractAddress: string,
  actionType: string
): Promise<void> {
  let zk_verify_result = event.event.attributes.find(
    (attr) => attr.key === "zk_verify"
  )!.value!;

  if (zk_verify_result === "true") {
    const piA = event.event.attributes.find((attr) => attr.key === "pi_a")!
      .value!;
    const piB = event.event.attributes.find((attr) => attr.key === "pi_b")!
      .value!;
    const piC = event.event.attributes.find((attr) => attr.key === "pi_c")!
      .value!;
    const commitment = event.event.attributes.find(
      (attr) => attr.key === "commitment"
    )!.value!;

    let timestamp = event.tx.block.header.time.getTime().toString();
    const eventRecord = ProcessProof.create({
      id: `${event.tx.hash}-${event.msg.idx}-${event.idx}`,
      blockHeight: BigInt(event.block.block.header.height),
      timestamp,
      txHash: event.tx.hash,
      actionType,
      piA,
      piB,
      piC,
      commitment,
      contractAddress: contractAddress,
    });

    await eventRecord.save();
  }
}

export async function handleSetVoteOption(
  event: CosmosEvent,
  roundRecord: Round
): Promise<void> {
  const voteOptionMap = event.event.attributes.find(
    (attr) => attr.key === "vote_option_map"
  )!.value!;
  roundRecord.voteOptionMap = voteOptionMap;
  roundRecord.save();
}

export async function handleStopTallyingPeriod(
  event: CosmosEvent,
  roundRecord: Round
): Promise<void> {
  logger.info(`------------------- stop tallying period`);
  logger.info(event.event.attributes);

  const results = event.event.attributes.find((attr) => attr.key === "results")!
    .value!;
  const allResult = event.event.attributes.find(
    (attr) => attr.key === "all_result"
  )!.value!;

  roundRecord.results = results;
  roundRecord.allResult = allResult;
  roundRecord.save();
}

export async function handleGrant(
  event: CosmosEvent,
  roundRecord: Round
): Promise<void> {
  logger.info(`------------------- grant`);
  logger.info(event.event.attributes);

  const maxAmount = event.event.attributes.find(
    (attr) => attr.key === "max_amount"
  )!.value!;
  const baseAmount = event.event.attributes.find(
    (attr) => attr.key === "base_amount"
  )!.value!;
  const bondAmount = event.event.attributes.find(
    (attr) => attr.key === "bond_amount"
  )!.value!;

  roundRecord.totalGrant = maxAmount;
  roundRecord.baseGrant = baseAmount;
  roundRecord.totalBond = (
    Number(roundRecord.totalBond) + Number(bondAmount)
  ).toString();
  roundRecord.gasStationEnable = true;
  roundRecord.save();
}

export async function handleRevoke(
  event: CosmosEvent,
  roundRecord: Round
): Promise<void> {
  logger.info(`------------------- revoke`);
  logger.info(event.event.attributes);

  roundRecord.totalGrant = "0";
  roundRecord.baseGrant = "0";
  roundRecord.gasStationEnable = false;
  roundRecord.save();
}

export async function handleBond(
  event: CosmosEvent,
  roundRecord: Round
): Promise<void> {
  logger.info(`------------------- bond`);

  const bondAmount = event.event.attributes.find(
    (attr) => attr.key === "amount"
  )!.value!;

  roundRecord.totalBond = (
    Number(roundRecord.totalBond) + Number(bondAmount)
  ).toString();
  roundRecord.save();
}

export async function handleWithdraw(
  event: CosmosEvent,
  roundRecord: Round
): Promise<void> {
  logger.info(`------------------- withdraw`);
  logger.info(event.event.attributes);

  const withdrawAmount = event.event.attributes.find(
    (attr) => attr.key === "amount"
  )!.value!;

  roundRecord.totalBond = (
    Number(roundRecord.totalBond) - Number(withdrawAmount)
  ).toString();
  roundRecord.save();
}
