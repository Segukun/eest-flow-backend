import Category from "../models/category.model.js";
import ApiError from "../utils/apiError.js";

export const createCategory = async (categoryData) => {
  const exists = await Category.findOne({ name: categoryData.name.trim() });
  if (exists) {
    throw new ApiError(400, "Category already exists");
  }
  return await Category.create(categoryData);
};

export const getCategories = async () => {
  return await Category.find({ active: true });
};

export const getCategoryById = async (categoryId) => {
  const category = await Category.findById(categoryId);
  if (!category) throw new ApiError(404, "Category not found");
  return category;
};

export const updateCategory = async (categoryId, categoryData) => {
  const category = await Category.findByIdAndUpdate(categoryId, categoryData, {
    returnDocument: "after",
    runValidators: true,
  });
  if (!category) throw new ApiError(404, "Category not found");
  return category;
};

//Las categorias van a tener un soft delete para que sea consistente con el resto del sistema. Como quedan solo desactivadas no rompe tanto el tema de las tareas asociadas.Y en el frontend tirar un "estas seguro, vas a eliminar la categoria de las siguientes tarjetas..." o algo por el estilo.
//TODO: Cuando pasa esto eliminar el contenido del campo category de las tarjetas asociadas.
export const disableCategory = async (categoryId) => {
  const category = await Category.findByIdAndUpdate(
    categoryId,
    { active: false },
    { returnDocument: "after" },
  );
  if (!category) throw new ApiError(404, "Category not found");
  return category;
};
