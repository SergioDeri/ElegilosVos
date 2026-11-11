"use client";

// Contraseña nueva + "Repetí la contraseña" (registro y recuperar). Si no
// coinciden, el campo repetido queda inválido para el navegador (el formulario
// no se manda) y el aviso aparece cuando la repetida ya es tan larga como la
// primera o al salir del campo: no mientras se la está escribiendo.
// Los nombres de los campos son `password` y `repetida`.
import { useId, useRef, useState } from "react";

export const LARGO_MINIMO = 8; // igual a auth.minimum_password_length (supabase/config.toml)

export const NO_COINCIDEN = "Las contraseñas no coinciden.";

export function ContrasenaNueva({ etiqueta, etiquetaRepetida }: { etiqueta: string; etiquetaRepetida: string }) {
  const [password, setPassword] = useState("");
  const [repetida, setRepetida] = useState("");
  const [salioDeRepetida, setSalioDeRepetida] = useState(false);
  const repetidaRef = useRef<HTMLInputElement>(null);
  const idAviso = useId();
  const noCoinciden =
    repetida !== "" && repetida !== password && (salioDeRepetida || repetida.length >= password.length);

  function actualizar(nuevaPassword: string, nuevaRepetida: string) {
    setPassword(nuevaPassword);
    setRepetida(nuevaRepetida);
    repetidaRef.current?.setCustomValidity(
      nuevaRepetida !== "" && nuevaRepetida !== nuevaPassword ? NO_COINCIDEN : "",
    );
  }

  return (
    <>
      <label>
        {etiqueta} (mínimo {LARGO_MINIMO} caracteres)
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={LARGO_MINIMO}
          required
          value={password}
          onChange={(e) => actualizar(e.target.value, repetida)}
        />
      </label>
      <label>
        {etiquetaRepetida}
        <input
          ref={repetidaRef}
          name="repetida"
          type="password"
          autoComplete="new-password"
          minLength={LARGO_MINIMO}
          required
          value={repetida}
          aria-invalid={noCoinciden}
          aria-describedby={noCoinciden ? idAviso : undefined}
          onChange={(e) => actualizar(password, e.target.value)}
          onBlur={() => setSalioDeRepetida(true)}
        />
      </label>
      {noCoinciden && (
        <p id={idAviso} role="alert">
          {NO_COINCIDEN}
        </p>
      )}
    </>
  );
}
