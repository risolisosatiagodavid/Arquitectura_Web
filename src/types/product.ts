export interface Product {
  id: number;
  tienda_id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  stock: number;
}

export interface CreateProductInput {
  nombre: string;
  descripcion: string;
  precio: number;
  stock: number;
}

export type UpdateProductInput = Partial<CreateProductInput>;
