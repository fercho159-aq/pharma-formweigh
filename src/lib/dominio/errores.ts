/** Error de regla de negocio: el mensaje es seguro para mostrar al usuario. */
export class ErrorDominio extends Error {
  constructor(
    mensaje: string,
    public readonly codigo: string,
    public readonly status: 400 | 403 | 404 | 409 | 429 = 409,
  ) {
    super(mensaje);
    this.name = "ErrorDominio";
  }
}
