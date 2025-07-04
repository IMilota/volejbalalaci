const eventDao = require("../../../dao/volejbalalaci/event-dao.js");
const attendanceDao = require("../../../dao/volejbalalaci/attendance-dao.js");

async function ListAbl(req, res) {
  try {
    const eventList = eventDao.list();

    const attendanceMap = attendanceDao.eventMap();

    eventList.forEach((event) => {
      event.userMap = attendanceMap[event.id] || {};
    });

    res.json(eventList);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}

module.exports = ListAbl;
