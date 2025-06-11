const express = require("express");
const router = express.Router();

const GetAbl = require("../../abl/volejbalalaci/event/getAbl");
const ListAbl = require("../../abl/volejbalalaci/event/listAbl");
const CreateAbl = require("../../abl/volejbalalaci/event/createAbl");
const UpdateAbl = require("../../abl/volejbalalaci/event/updateAbl");
const DeleteAbl = require("../../abl/volejbalalaci/event/deleteAbl");

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
