const express = require("express");
const router = express.Router();

const GetAbl = require("../../abl/volejbalalaci/message/getAbl");
const ListAbl = require("../../abl/volejbalalaci/message/listAbl");
const CreateAbl = require("../../abl/volejbalalaci/message/createAbl");
const UpdateAbl = require("../../abl/volejbalalaci/message/updateAbl");
const DeleteAbl = require("../../abl/volejbalalaci/message/deleteAbl");

router.get("/get", (req, res) => {
  GetAbl(req, res);
});

router.get("/list", (req, res) => {
  ListAbl(req, res);
});

router.post("/create", (req, res) => {
  CreateAbl(req, res);
});

router.post("/update", (req, res) => {
  UpdateAbl(req, res);
});

router.post("/delete", (req, res) => {
  DeleteAbl(req, res);
});

module.exports = router;
