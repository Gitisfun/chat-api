import ApiError from "../errors/errors.js";


function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    res.status(err.code).json(err.message);
    next();
    return;
  }
  res.status(500).json("Something went wrong on the server");
}

export default errorHandler;