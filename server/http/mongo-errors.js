function mapMongoError(err) {
  if (!err) return null;
  if (err.name === "ValidationError") {
    return { status: 400, code: "dtoInIsNotValid", message: err.message };
  }
  if (err.name === "CastError" || err.name === "BSONError" || err.name === "BSONTypeError") {
    return { status: 400, code: "dtoInIsNotValid", message: err.message };
  }
  if (err.code === 11000) {
    const key = Object.keys(err.keyPattern || err.keyValue || {})[0];
    if (key === "email") {
      return { status: 409, code: "emailAlreadyExists", message: "email already exists" };
    }
    if (key === "nickname") {
      return { status: 409, code: "nicknameAlreadyExists", message: "nickname already exists" };
    }
    return { status: 409, code: "dtoInIsNotValid", message: "duplicate key" };
  }
  return null;
}

module.exports = { mapMongoError };
