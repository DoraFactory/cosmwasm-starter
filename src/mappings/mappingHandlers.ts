import { ExecuteEvent, Message, Round, Transaction } from "../types";
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

// export async function handleEvent(event: CosmosEvent): Promise<void> {
//   logger.info("=================== Event =====================");
//   logger.info("===============================================");
//   logger.info(`handleEvent ${JSON.stringify(event)}`)
//   logger.info(`Event ${JSON.stringify(event.event.attributes)}`)
//   logger.info(`height ${JSON.stringify(event.block.block.header.height)}`)

//   const eventRecord = ExecuteEvent.create({
//     id: `${event.tx.hash}-${event.msg.idx}-${event.idx}`,
//     blockHeight: BigInt(event.block.block.header.height),
//     txHash: event.tx.hash,
//     contractAddress: event.event.attributes.find(attr => attr.key === '_contract_address')!.value
//   });

//   await eventRecord.save();
// }

// export async function handleInstantiateEvent(event: CosmosEvent): Promise<void> {
//   logger.info("=================== Instantiate Event =====================");
//   logger.info("===============================================");
//   // logger.info(`handleInstantiateEvent ${JSON.stringify(event)}`)
//   logger.info(`Event ${JSON.stringify(event.event.attributes)}`)
//   logger.info(`height ${JSON.stringify(event.block.block.header.height)}`)
// }


export async function handleInstantiateMessage(msg: CosmosMessage): Promise<void> {
  logger.info("=================== Instantiate Message =====================");
  logger.info("=================================================");

  let code_id = msg.msg.decodedMsg["codeId"]["low"];
  if (code_id === 16 || code_id === 17) {
    logger.info("======================== circuit maci qf !!!!! =========================");
    let circuit = "MACI-QF"
    let blockHeight = msg.block.block.header.height
    logger.info(msg.tx.block.header.time)
    logger.info(msg.tx.block.header.time.getTime())
    let timestamp = new Date(msg.tx.block.header.time.getTime())
    logger.info(timestamp.toDateString)
    let txHash = msg.tx.hash
    let status = RoundStatus.Created;
    let period = PeriodStatus.Pending;
    let actionType = RoundActionType.Deploy;
    let operator = msg.msg.decodedMsg["sender"];
    let contractAddress =  msg.tx.tx.events.find(event => event.type === 'instantiate')!.attributes.find(attr => attr.key === "_contract_address")?.value
    let roundId = msg.msg.decodedMsg["msg"]["round_id"];
    let roundDescription = msg.msg.decodedMsg["msg"]["round_description"];
    let maciDenom = msg.msg.decodedMsg["msg"]["maci_denom"];
    let other = JSON.stringify(msg.msg.decodedMsg);
    logger.info(`contractAddress: ${contractAddress}`);

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
