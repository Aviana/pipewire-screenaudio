// Any event, that is handled in here, should have a comment with the reason it is handled in here

let commandsQueue = []
let commandsQueueRunning = false

function sendNativeMessage (messageName, cmd, args) {
  return chrome.runtime.sendNativeMessage(messageName, { cmd, args: (args ? [args] : undefined) })
}

async function runQueuedCommands () {
  commandsQueueRunning = true;

  while (commandsQueue.length) {
    try {
      const command = commandsQueue.shift();
      const args = { ...command.args };
      const { inMap, outMap } = command.maps || {};

      if (inMap) {
        for (const [storageKey, argKey] of inMap) {
          args[argKey] = await chrome.runtime.sendMessage({ messageName: "get-storage", storageKey: storageKey })
        }
      }

      console.log(args)
      const result = await sendNativeMessage(command.messageName, command.cmd, args, command.maps)
      console.log(result)

      if (outMap) {
        for (const [storageKey, resultKey] of outMap) {
          const value = resultKey ? result[resultKey] : null
          await chrome.runtime.sendMessage({ messageName: 'set-storage', storageKey: storageKey, value: value })
        }
      }

      if (command.event) {
        chrome.runtime.sendMessage(command.event);
      }
    } catch (err) {
      console.error(err)
    }
  }

  commandsQueueRunning = false;
}

function handleMessage(request) {
  // Run multiple commands sequentially
  if (request.message === "enqueue-command") {
    commandsQueue.push({ ...request.command, messageName: request.messageName })
    if (!commandsQueueRunning) {
      runQueuedCommands();
    }
  }

  // Called from injector.js - It cannot directly call sendNativeMessage
  if (request.message === "get-session-type") {
    return sendNativeMessage(request.messageName, "GetSessionType");
  }
}

chrome.runtime.onMessage.addListener(handleMessage);
