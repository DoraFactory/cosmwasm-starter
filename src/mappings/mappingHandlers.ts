import { PublishMessageEvent, Round, SignUpEvent, Transaction, ProcessProof } from "../types";
import {
  CosmosEvent,
  CosmosBlock,
  CosmosMessage,
  CosmosTransaction,
} from "@subql/types-cosmos";

enum RoundStatus {
  Created = "Created",
  Ongoing = "Ongoing",
  Tallying = "Tallying",
  Closed = "Closed"
}

enum PeriodStatus {
  Pending = "Pending",
  Voting = "Voting",
  Processing = "Processing",
  Tallying = "Tallying",
  Ended = "Ended"
}

enum RoundActionType {
  Deploy = "op:deploy",
  SetConfig = "op:settings",
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
  Fail = "Fail"
}

export async function handleMessage(msg: CosmosMessage): Promise<void> {
  logger.info("=================== Message =====================");
  logger.info("=================================================");
  logger.info(`Message ${JSON.stringify(msg.tx.decodedTx)}`)
  logger.info(`Message ${JSON.stringify(msg.msg.decodedMsg)}`)
  logger.info(`height ${JSON.stringify(msg.block.block.header.height)}`)

  let contractAddress = msg.msg.decodedMsg.contract;

  let roundRecord = await Round.get(contractAddress);
  if (roundRecord !== undefined) {
    let type = "";
    let actionName = Object.keys(msg.msg.decodedMsg.msg)[0]
    logger.info(actionName);

    if (actionName === "set_round_info") {
      type = RoundActionType.SetConfig;
    } else if (actionName === "set_whitelists") {
      type = RoundActionType.SetConfig;
    } else if (actionName === "set_vote_options_map") {
      type = RoundActionType.SetConfig;
    } else if (actionName === "start_voting_period") {
      roundRecord.period = PeriodStatus.Voting
      roundRecord.status = RoundStatus.Ongoing
      roundRecord.save()
      type = RoundActionType.StartVoting;
    } else if (actionName === "sign_up") {
      roundRecord.period = PeriodStatus.Voting
      roundRecord.status = RoundStatus.Ongoing
      roundRecord.save()
      type = RoundActionType.SignUp;
    } else if (actionName === "publish_message") {
      roundRecord.period = PeriodStatus.Voting
      roundRecord.status = RoundStatus.Ongoing
      roundRecord.save()
      type = RoundActionType.Vote;
    } else if (actionName === "stop_voting_period") {
      roundRecord.period = PeriodStatus.Processing
      roundRecord.status = RoundStatus.Tallying
      roundRecord.save()
      type = RoundActionType.StopVoting;
    } else if (actionName === "start_process_period") {
      roundRecord.period = PeriodStatus.Processing
      roundRecord.status = RoundStatus.Tallying
      roundRecord.save()
      type = RoundActionType.StartProcessing;
    } else if (actionName === "process_message") {
      roundRecord.period = PeriodStatus.Processing
      roundRecord.status = RoundStatus.Tallying
      roundRecord.save()
      type = RoundActionType.Verify;
    } else if (actionName === "stop_processing_period") {
      roundRecord.period = PeriodStatus.Tallying
      roundRecord.status = RoundStatus.Tallying
      roundRecord.save()
      type = RoundActionType.StopProcessing;
    } else if (actionName === "process_tally") {
      roundRecord.period = PeriodStatus.Tallying
      roundRecord.status = RoundStatus.Tallying
      roundRecord.save()
      type = RoundActionType.Verify;
    } else if (actionName === "stop_tallying_period") {
      roundRecord.period = PeriodStatus.Ended
      roundRecord.status = RoundStatus.Closed
      roundRecord.save()
      type = RoundActionType.StopTallying;
    }

    let blockHeight = BigInt(msg.block.block.header.height)
    let txHash = msg.tx.hash
    let timestamp = msg.tx.block.header.time.getTime().toString()
    let sender = msg.msg.decodedMsg.sender
    let txSTatus = TxStatus.Success;
    let fee = msg.tx.tx.events.find(event => event.type === 'tx')!.attributes.find(attr => attr.key === "fee")?.value
    if (fee === undefined) {
      fee = "0uDORA"
      txSTatus = TxStatus.Fail
    }
    let gasUsed = BigInt(msg.tx.tx.gasUsed);
    let gasWanted = BigInt(msg.tx.tx.gasWanted);
    // let other = JSON.stringify(msg.msg.decodedMsg);
    // let event = JSON.stringify(msg.tx.tx.events);
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
      // other: other,
    })
    txRecord.save()

    logger.info(`-----------------------------------------------------`)
    logger.info(`-------------------- Transaction --------------------`)
    logger.info(`-----------------------------------------------------`)
    logger.info(`${blockHeight} Save transaction - ${contractAddress} : ${actionName} ${sender}`);
  }
}

export async function handleInstantiateMessage(msg: CosmosMessage): Promise<void> {
  logger.info("=================== Instantiate Message =====================");
  logger.info("=================================================");

  let code_id = msg.msg.decodedMsg["codeId"]["low"];
  if (code_id === 46) {
    logger.info("======================== circuit maci qf !!!!! =========================");
    let circuit = "MACI-QF"
    let blockHeight = msg.block.block.header.height
    let timestamp = msg.tx.block.header.time.getTime().toString()
    let txHash = msg.tx.hash
    let status = RoundStatus.Created;
    let period = PeriodStatus.Pending;
    let actionType = RoundActionType.Deploy;
    let operator = msg.msg.decodedMsg["sender"];
    let contractAddress =  msg.tx.tx.events.find(event => event.type === 'instantiate')!.attributes.find(attr => attr.key === "_contract_address")?.value

    // let roundTitle = msg.msg.decodedMsg["msg"]["round_info"]["title"];
    // let roundDescription = msg.msg.decodedMsg["msg"]["round_info"]["description"];
    // let roundLink = msg.msg.decodedMsg["msg"]["round_info"]["link"];
    let roundInfo = msg.msg.decodedMsg["msg"]["round_info"]
    let roundTitle = roundInfo["title"]
    let roundDescription = roundInfo["description"]
    let roundLink = roundInfo["link"]

    let votingStart = "0"
    let votingEnd = "0"

    let votingTimeData = msg.msg.decodedMsg["msg"]["voting_time"]
    if (votingTimeData !== null) {
      if (votingTimeData["start_time"] !== null) {
        votingStart = votingTimeData["start_time"]
      }

      if (votingTimeData["end_time"] !== null) {
        votingEnd = votingTimeData["end_time"]
      }
    }

    let maciDenom = "uDORA";
    // let other = JSON.stringify(msg.msg.decodedMsg);
    logger.info(`contractAddress: ${contractAddress}`);
    let allRound = await store.getByField(`Round`, "maciDenom", maciDenom, { limit: 100000 }) as unknown as Round[];

    let roundId = (allRound.length + 1).toString()
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
      maciDenom,
    });


    let sender = operator
    let txSTatus = TxStatus.Success;
    let fee = msg.tx.tx.events.find(event => event.type === 'tx')!.attributes.find(attr => attr.key === "fee")?.value
    if (fee === undefined) {
      fee = "0uDORA"
      txSTatus = TxStatus.Fail
    }
    let gasUsed = BigInt(msg.tx.tx.gasUsed);
    let gasWanted = BigInt(msg.tx.tx.gasWanted);
    // let other = JSON.stringify(msg.msg.decodedMsg);
    // let event = JSON.stringify(msg.tx.tx.events);
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
    })
    txRecord.save()

    logger.info(`-----------------------------------------------`)
    logger.info(`-------------------- Round --------------------`)
    logger.info(`-----------------------------------------------`)
    logger.info(`${blockHeight} Save round - ${contractAddress} : #${roundId} ${roundDescription}`);

    await roundRecord.save();

  }
}

export async function handleEvent(event: CosmosEvent): Promise<void> {
  logger.info("=================== Event =====================");
  logger.info("===============================================");
  logger.info(`handleEvent ${JSON.stringify(event.event.attributes)}`)
  logger.info(`height ${JSON.stringify(event.block.block.header.height)}`)


  let contractAddress =  event.event.attributes.find(attr => attr.key === "_contract_address")?.value!

  let action_event =  event.event.attributes.find(attr => attr.key === "action")?.value

  logger.info(action_event);
  logger.info(action_event === "sign_up");

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
    }
  }
}

export async function handleSignUpEvent(event: CosmosEvent, contractAddress: string): Promise<void> {
  let stateIdx =  event.event.attributes.find(attr => attr.key === "state_idx")?.value!
  let pubKey =  event.event.attributes.find(attr => attr.key === "pubkey")?.value!
  let balance =  event.event.attributes.find(attr => attr.key === "balance")?.value!
  let timestamp = event.tx.block.header.time.getTime().toString()

  const eventRecord = SignUpEvent.create({
    id: `${event.tx.hash}-${event.msg.idx}-${event.idx}`,
    blockHeight: BigInt(event.block.block.header.height),
    timestamp,
    txHash: event.tx.hash,
    stateIdx,
    pubKey,
    balance,
    contractAddress,
  });

  await eventRecord.save();
  logger.info(`-----------------------------------------------------`)
  logger.info(`------------------- SignUp Event --------------------`)
  logger.info(`-----------------------------------------------------`)
  logger.info(`${eventRecord.blockHeight} Save sign_up event - ${contractAddress} : ${stateIdx} ${pubKey} ${balance}`);
}

export async function handlePublishMessageEvent(event: CosmosEvent, contractAddress: string): Promise<void> {
  let msgChainLength =  event.event.attributes.find(attr => attr.key === "msg_chain_length")?.value
  let message =  event.event.attributes.find(attr => attr.key === "message")?.value
  let enc_pub_key =  event.event.attributes.find(attr => attr.key === "enc_pub_key")?.value
  if (msgChainLength !== undefined && message !== undefined && enc_pub_key !== undefined) {
    let timestamp = event.tx.block.header.time.getTime().toString()
    const eventRecord = PublishMessageEvent.create({
      id: `${event.tx.hash}-${event.msg.idx}-${event.idx}`,
      blockHeight: BigInt(event.block.block.header.height),
      timestamp,
      txHash: event.tx.hash,
      msgChainLength: msgChainLength!,
      message: message!,
      encPubKey: enc_pub_key!,
      contractAddress: contractAddress,
    });

    await eventRecord.save();

    logger.info(`-----------------------------------------------------`)
    logger.info(`--------------- PublishMessage Event ----------------`)
    logger.info(`-----------------------------------------------------`)
    logger.info(`${eventRecord.blockHeight} Save publish_message event - ${contractAddress} : ${msgChainLength} ${message} ${enc_pub_key}`);
  }
}

export async function handleSetRoundInfoEvent(event: CosmosEvent, roundRecord: Round): Promise<void> {
  let roundTitle = event.event.attributes.find(attr => attr.key === "title")!.value!
  let roundDescription = event.event.attributes.find(attr => attr.key === "description")?.value
  let roundLink = event.event.attributes.find(attr => attr.key === "link")?.value
  
  if (roundDescription === undefined) {
    roundDescription = ""
  }

  if (roundLink === undefined) {
    roundLink = ""
  }

  roundRecord.roundTitle = roundTitle
  roundRecord.roundDescription = roundDescription
  roundRecord.roundLink = roundLink
  roundRecord.save()
}

export async function handleStartVotingEvent(event: CosmosEvent, roundRecord: Round): Promise<void> {
  const votingStart =  event.event.attributes.find(attr => attr.key === "start_time")!.value!
  roundRecord.votingStart = votingStart
  roundRecord.save()
}

export async function handleStopVotingEvent(event: CosmosEvent, roundRecord: Round): Promise<void> {
  const votingEnd =  event.event.attributes.find(attr => attr.key === "end_time")!.value!
  // roundRecord.votingEnd = new Date(votingEnd)
  roundRecord.votingEnd = votingEnd
  roundRecord.save()
}

export async function handleProofEvent(event: CosmosEvent, contractAddress: string, actionType: string): Promise<void> {
  let zk_verify_result = event.event.attributes.find(attr => attr.key === "zk_verify")!.value!

  if (zk_verify_result === "true") {
    const piA = event.event.attributes.find(attr => attr.key === "pi_a")!.value!
    const piB = event.event.attributes.find(attr => attr.key === "pi_b")!.value!
    const piC = event.event.attributes.find(attr => attr.key === "pi_c")!.value!
    const commitment = event.event.attributes.find(attr => attr.key === "commitment")!.value!

    let timestamp = event.tx.block.header.time.getTime().toString()
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
