const Joi = require("joi");

const disasterSchema = Joi.object({
  title: Joi.string().required().min(3).max(200),
  location_name: Joi.string().required().min(2).max(200),
  description: Joi.string().required().min(10).max(2000),
  tags: Joi.array().items(Joi.string()).default([]),
});

const reportSchema = Joi.object({
  disaster_id: Joi.string().uuid().required(),
  content: Joi.string().required().min(5).max(1000),
  image_url: Joi.string().uri().optional(),
});

const resourceSchema = Joi.object({
  disaster_id: Joi.string().uuid().required(),
  name: Joi.string().required().min(2).max(200),
  location_name: Joi.string().required().min(2).max(200),
  type: Joi.string()
    .required()
    .valid("shelter", "hospital", "food", "water", "medical", "rescue"),
});

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }
    next();
  };
};

module.exports = {
  validate,
  disasterSchema,
  reportSchema,
  resourceSchema,
};
