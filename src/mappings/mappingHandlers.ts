import { PublishMessageEvent, Round, SignUpEvent, Transaction } from "../types";
import {
  CosmosEvent,
  CosmosBlock,
  CosmosMessage,
  CosmosTransaction,
} from "@subql/types-cosmos";

/*
export async function handleBlock(block: CosmosBlock): Promise<void> {
  // If you want to index each block in Cosmos (CosmosHub), you could do that here
}
*/

/*
export async function handleTransaction(tx: CosmosTransaction): Promise<void> {
  // If you want to index each transaction in Cosmos (CosmosHub), you could do that here
  const transactionRecord = Transaction.create({
    id: tx.hash,
    blockHeight: BigInt(tx.block.block.header.height),
    timestamp: tx.block.block.header.time,
  });
  await transactionRecord.save();
}
*/
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
  SignUp = "signup",
  DeactivateKey = "msg:deactivateKey",
  Vote = "msg:vote",
  Verify = "op:verify",
  Deposit = "deposit",
  NewKey = "msg:newKey",
  StopVoting = "op:stopVoting",
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
  logger.info(`Message ${JSON.stringify(msg.msg.decodedMsg)}`)
  logger.info(`height ${JSON.stringify(msg.block.block.header.height)}`)

  let contractAddress = msg.msg.decodedMsg.contract;

  let roundRecord = await Round.get(contractAddress);
  if (roundRecord !== undefined) {
    let type = "";
    let actionName = Object.keys(msg.msg.decodedMsg.msg)[0]
    logger.info(actionName);
    if (actionName === "sign_up") {
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
    let timestamp = new Date(msg.tx.block.header.time.getTime())
    let sender = msg.msg.decodedMsg.sender
    let txSTatus = TxStatus.Success;
    let fee = msg.tx.tx.events.find(event => event.type === 'tx')!.attributes.find(attr => attr.key === "fee")?.value
    if (fee === undefined) {
      fee = "0uDORA"
      txSTatus = TxStatus.Fail
    }
    let gasUsed = BigInt(msg.tx.tx.gasUsed);
    let gasWanted = BigInt(msg.tx.tx.gasWanted);
    let other = JSON.stringify(msg.msg.decodedMsg);
    // let event = JSON.stringify(msg.tx.tx.events);
    let txRecord = Transaction.create({
      id: txHash,
      blockHeight: blockHeight,
      txHash: txHash,
      timestamp: timestamp,
      type: type,
      status: txSTatus,
      roundId: roundRecord.roundId,
      roundDescription: roundRecord.roundDescription,
      circuitName: roundRecord.circuitName,
      fee: fee,
      gasUsed: gasUsed,
      gasWanted: gasWanted,
      caller: sender,
      contractAddress: contractAddress,
      other: other,
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
  if (code_id === 21 || code_id === 35) {
    logger.info("======================== circuit maci qf !!!!! =========================");
    let circuit = "MACI-QF"
    let blockHeight = msg.block.block.header.height
    let timestamp = new Date(msg.tx.block.header.time.getTime())
    let txHash = msg.tx.hash
    let status = RoundStatus.Created;
    let period = PeriodStatus.Pending;
    let actionType = RoundActionType.Deploy;
    let operator = msg.msg.decodedMsg["sender"];
    let contractAddress =  msg.tx.tx.events.find(event => event.type === 'instantiate')!.attributes.find(attr => attr.key === "_contract_address")?.value
    // let roundId = msg.msg.decodedMsg["msg"]["round_id"];
    let roundDescription = msg.msg.decodedMsg["msg"]["round_description"];
    let maciDenom = "uDORA";
    let other = JSON.stringify(msg.msg.decodedMsg);
    logger.info(`contractAddress: ${contractAddress}`);
    let allRound = await store.getByField(`Round`, "maciDenom", maciDenom, { limit: 100000 }) as unknown as Round[];

    let roundId = (allRound.length + 1).toString()
    const roundRecord = Round.create({
      id: `${contractAddress}`,
      blockHeight: BigInt(blockHeight),
      txHash: txHash,
      operator: operator,
      contractAddress: contractAddress!,
      circuitName: circuit,
      timestamp: timestamp,
      status: status,
      period: period,
      actionType: actionType,
      roundId: roundId,
      roundDescription: roundDescription,
      maciDenom: maciDenom,
      other: other,
    });

    logger.info(`-----------------------------------------------`)
    logger.info(`-------------------- Round --------------------`)
    logger.info(`-----------------------------------------------`)
    logger.info(`${blockHeight} Save round - ${contractAddress} : #${roundId} ${roundDescription}`);

    await roundRecord.save();

  }
}

export async function handleSignUpEvent(event: CosmosEvent): Promise<void> {
  logger.info("=================== Event =====================");
  logger.info("===============================================");
  logger.info(`handleEvent ${JSON.stringify(event.event.attributes)}`)
  logger.info(`height ${JSON.stringify(event.block.block.header.height)}`)


  let contractAddress =  event.event.attributes.find(attr => attr.key === "_contract_address")?.value!

  let action_event =  event.event.attributes.find(attr => attr.key === "action")?.value

  logger.info(action_event);
  logger.info(action_event === "sign_up");

  let roundRecord = await Round.get(contractAddress);
  if (roundRecord !== undefined && action_event === "sign_up") {
    let stateIdx =  event.event.attributes.find(attr => attr.key === "state_idx")?.value!
    let pubKey =  event.event.attributes.find(attr => attr.key === "pubkey")?.value!
    let balance =  event.event.attributes.find(attr => attr.key === "balance")?.value!
    let timestamp = new Date(event.tx.block.header.time.getTime())

    const eventRecord = SignUpEvent.create({
      id: `${event.tx.hash}-${event.msg.idx}-${event.idx}`,
      blockHeight: BigInt(event.block.block.header.height),
      timestamp: timestamp,
      txHash: event.tx.hash,
      stateIdx: stateIdx,
      pubKey: pubKey,
      balance: balance,
      contractAddress: event.event.attributes.find(attr => attr.key === '_contract_address')!.value
    });

    await eventRecord.save();
    logger.info(`-----------------------------------------------------`)
    logger.info(`------------------- SignUp Event --------------------`)
    logger.info(`-----------------------------------------------------`)
    logger.info(`${eventRecord.blockHeight} Save sign_up event - ${contractAddress} : ${stateIdx} ${pubKey} ${balance}`);
  }
}

export async function handleMessageEvent(event: CosmosEvent): Promise<void> {
  logger.info("=================== Event =====================");
  logger.info("===============================================");
  logger.info(`handleEvent ${JSON.stringify(event.event.attributes)}`)
  logger.info(`height ${JSON.stringify(event.block.block.header.height)}`)

  let contractAddress =  event.event.attributes.find(attr => attr.key === "_contract_address")?.value!
  let action_event =  event.event.attributes.find(attr => attr.key === "action")?.value

  logger.info(action_event);
  logger.info(action_event === "publish_message");

  let roundRecord = await Round.get(contractAddress);
  if (roundRecord !== undefined && action_event === "publish_message") {
    let msgChainLength =  event.event.attributes.find(attr => attr.key === "msg_chain_length")?.value
    let message =  event.event.attributes.find(attr => attr.key === "message")?.value
    let enc_pub_key =  event.event.attributes.find(attr => attr.key === "enc_pub_key")?.value
    if (msgChainLength !== undefined && message !== undefined && enc_pub_key !== undefined) {
      let timestamp = new Date(event.tx.block.header.time.getTime())
      const eventRecord = PublishMessageEvent.create({
        id: `${event.tx.hash}-${event.msg.idx}-${event.idx}`,
        blockHeight: BigInt(event.block.block.header.height),
        timestamp: timestamp,
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
}
