const Quest = require('../models/Quest');
const { getQuest } = require('./index');

function objectiveKey(objective) {
  const targetId = objective.monsterId || objective.npcId || objective.roomId || objective.itemId || null;
  return targetId ? `${objective.type}:${targetId}` : objective.type;
}

function eventKey(event) {
  return event.target ? `${event.type}:${event.target}` : event.type;
}

class QuestProgressService {
  constructor() {
    this._socketIo = null;
  }

  init(io) {
    this._socketIo = io;
  }

  async checkProgress(userId, event) {
    const activeQuests = await Quest.find({
      userId,
      status: { $in: ['accepted', 'in_progress'] }
    });

    for (const quest of activeQuests) {
      const config = getQuest(quest.questId);
      if (!config) continue;

      let updated = false;

      for (const objective of config.objectives) {
        const key = objectiveKey(objective);
        const eKey = eventKey(event);

        if (key === eKey || (objective.monsterId === 'any' && event.type === 'kill') || (objective.roomId === 'any' && event.type === 'visit') || (objective.itemId === 'any' && event.type === 'collect')) {
          // For learn_skill objectives with minLevel, check that the learned skill meets the level requirement
          if (objective.type === 'learn_skill' && objective.minLevel && event.skillRequireLevel && event.skillRequireLevel < objective.minLevel) {
            continue;
          }

          const current = quest.progress.get(key) || 0;
          const target = objective.count || 1;
          if (current < target) {
            quest.progress.set(key, current + 1);
            updated = true;
          }
        }
      }

      if (updated) {
        const allDone = config.objectives.every(obj => {
          const key = objectiveKey(obj);
          const current = quest.progress.get(key) || 0;
          return current >= (obj.count || 1);
        });

        if (allDone) {
          quest.status = 'completed';
          quest.completedAt = new Date();
        } else {
          quest.status = 'in_progress';
        }

        await quest.save();

        this._notifyPlayer(userId, {
          questId: quest.questId,
          questName: config.name,
          progress: Object.fromEntries(quest.progress),
          status: quest.status
        });
      }
    }
  }

  _notifyPlayer(userId, data) {
    if (!this._socketIo) return;
    const sockets = this._socketIo.sockets.sockets;
    for (const [, socket] of sockets) {
      if (socket.user?._id?.toString() === userId.toString()) {
        socket.emit('quest_progress', data);
        break;
      }
    }
  }
}

module.exports = new QuestProgressService();
