"use client";

import { BookOpen } from "lucide-react";
import { useEffect } from "react";

const TOC: { href: string; label: string; sub?: boolean }[] = [
  { href: "#intro", label: "Por qué existe esto" },
  { href: "#orden", label: "Orden de uso" },
  { href: "#ingredientes", label: "1 · Ingredientes" },
  { href: "#parametros", label: "2 · Parámetros operativos" },
  { href: "#recetas", label: "3 · Recetas" },
  { href: "#recetas-ficha", label: "Ficha de costeo", sub: true },
  { href: "#recetas-resultado", label: "Resultado del costeo", sub: true },
  { href: "#recetas-precios", label: "Precios por canal", sub: true },
  { href: "#recetas-rentabilidad", label: "Rentabilidad", sub: true },
  { href: "#plan", label: "4 · Plan de producción" },
  { href: "#presupuestos", label: "5 · Presupuestos" },
  { href: "#canales", label: "Canales y catering" },
  { href: "#glosario", label: "Glosario" },
];

export default function ManualPage() {
  useEffect(() => {
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".mn-nav a"));
    const targets = links
      .map((a) => document.querySelector(a.getAttribute("href") ?? ""))
      .filter((el): el is Element => !!el);
    const setActive = (id: string) => {
      links.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${id}`));
    };
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  return (
    <div>
      <div className="ha-page-header">
        <div>
          <h1 className="ha-pagetitle" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BookOpen size={22} /> Manual del ahumadero
          </h1>
          <p className="mn-p" style={{ margin: 0 }}>Guía de las pantallas de costeo de Alumo — para todos los socios.</p>
        </div>
      </div>

      <p className="mn-lede">
        Esto reemplaza al Excel <b>«ALUMO — SISTEMA DE COSTOS v6»</b>. Todo lo que hacía esa planilla —costo de cada
        receta, precio por canal, plan de producción, presupuestos— ahora vive acá, conectado: cambiás el precio de
        un ingrediente una vez y se recalcula solo en todo lo demás.
      </p>
      <p className="mn-lede" style={{ marginTop: 8 }}>
        Cada sección explica qué es la pantalla, para qué sirve, y el paso a paso exacto de cómo usarla (qué botón
        tocar, qué campo completar). Los ejemplos usan números reales de recetas de Alumo.
      </p>

      <div className="mn-layout" style={{ marginTop: 28 }}>
        <nav className="mn-nav" aria-label="Índice del manual">
          <div className="mn-nav__eyebrow">En esta guía</div>
          <ol>
            {TOC.map((item) => (
              <li key={item.href}>
                <a href={item.href} className={item.sub ? "mn-sub" : undefined}>{item.label}</a>
              </li>
            ))}
          </ol>
        </nav>

        <main>
          {/* INTRO */}
          <section className="mn-section" id="intro">
            <div className="mn-kicker">Contexto</div>
            <h2 className="mn-h2">Por qué existe esto</h2>
            <p className="mn-dek">
              El Excel funcionaba, pero era un solo archivo: si dos personas lo tocaban a la vez, o alguien pisaba
              una fórmula sin querer, no había forma de saberlo. Acá cada dato vive en un solo lugar y las cuentas
              las hace el sistema — no una celda que cualquiera puede borrar.
            </p>
          </section>

          {/* ORDEN */}
          <section className="mn-section" id="orden">
            <div className="mn-kicker">Cómo empezar</div>
            <h2 className="mn-h2">Orden recomendado</h2>
            <p className="mn-dek">Las pantallas se alimentan unas de otras. Cargadas en este orden, cada paso ya tiene lo que necesita del anterior.</p>
            <div className="mn-flow">
              <div className="mn-flowstep">
                <div className="mn-flowstep__num">1</div>
                <div className="mn-flowstep__body"><h4>Ingredientes</h4><p>Qué comprás y a qué precio. De acá sale el costo de todo lo demás.</p></div>
              </div>
              <div className="mn-flowstep">
                <div className="mn-flowstep__num">2</div>
                <div className="mn-flowstep__body"><h4>Parámetros operativos</h4><p>Sueldos, costos fijos y capacidad — de acá sale cuánto cuesta una hora de trabajo.</p></div>
              </div>
              <div className="mn-flowstep">
                <div className="mn-flowstep__num">3</div>
                <div className="mn-flowstep__body"><h4>Recetas</h4><p>Armás el BOM y la ficha de costeo. El costo y el precio sugerido salen solos.</p></div>
              </div>
              <div className="mn-flowstep">
                <div className="mn-flowstep__num">4</div>
                <div className="mn-flowstep__body"><h4>Plan de producción (una vez al mes)</h4><p>Para saber si lo que pensás producir cubre sueldos y costos fijos.</p></div>
              </div>
              <div className="mn-flowstep">
                <div className="mn-flowstep__num">5</div>
                <div className="mn-flowstep__body"><h4>Presupuestos (cuando llega un evento)</h4><p>Cotizás un pedido puntual, con agregados y descuento.</p></div>
              </div>
            </div>
          </section>

          {/* INGREDIENTES */}
          <section className="mn-section" id="ingredientes">
            <div className="mn-kicker">1 · Materia prima <span className="mn-path">/ingredients</span></div>
            <h2 className="mn-h2">Ingredientes</h2>
            <p className="mn-dek">La lista de todo lo que comprás. Cargás cuánto y a qué precio; el sistema calcula el costo por unidad y lo usa automáticamente en el costeo de cada receta que lo lleve.</p>

            <h3 className="mn-h3">Cargar un ingrediente nuevo</h3>
            <ol className="mn-steps">
              <li>Arriba a la derecha, tocá <span className="mn-ui">+ Nuevo ingrediente</span>. Se abre un panel desde la derecha.</li>
              <li>Completá <span className="mn-ui">Nombre</span> y elegí la <span className="mn-ui">Unidad</span> (Unidad, Kg, Gr, Litro, Ml).</li>
              <li>Elegí una <span className="mn-ui">Categoría</span> (o dejalo en "Sin categoría") — es solo para ordenar la lista.</li>
              <li>Cargá <span className="mn-ui">Cantidad comprada</span> y <span className="mn-ui">Precio de compra ($)</span>: lo que compraste, tal cual la factura. Debajo del campo el sistema te recuerda que el costo unitario sale de dividir uno por el otro.</li>
              <li>Opcional: <span className="mn-ui">Proveedor</span> y <span className="mn-ui">Notas</span>.</li>
              <li>Tocá <span className="mn-ui">Guardar</span>.</li>
            </ol>
            <p className="mn-p">Para editar uno que ya existe: buscalo en la tabla (con la lupa de arriba, o cambiando la <span className="mn-ui">Categoría</span> del filtro) y tocá el lápiz al final de la fila.</p>

            <div className="mn-example">
              <div className="mn-example__label">Ejemplo real</div>
              <p className="mn-p" style={{ marginTop: 0 }}>Comprás un bidón de <b>Aceite</b>: 5 litros por $21.800.</p>
              <div className="mn-tablewrap">
                <table className="mn-table">
                  <tbody>
                    <tr><td>Cantidad comprada</td><td className="num">5 litros</td></tr>
                    <tr><td>Precio de compra</td><td className="num">$21.800</td></tr>
                    <tr className="mn-total"><td>Costo unitario (calculado solo)</td><td className="num">$4.360 / litro</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <h3 className="mn-h3">La columna Estado</h3>
            <div className="mn-tablewrap">
              <table className="mn-table">
                <thead><tr><th>Estado</th><th>Qué significa</th></tr></thead>
                <tbody>
                  <tr><td>Activo</td><td>Tiene precio y al menos una receta lo usa.</td></tr>
                  <tr><td>Sin precio</td><td>Nadie cargó cuánto sale — cualquier receta que lo use va a mostrar una alerta.</td></tr>
                  <tr><td>Sin uso</td><td>Tiene precio, pero ninguna receta activa lo usa hoy. No rompe nada.</td></tr>
                  <tr><td>Sin precio / sin uso</td><td>Las dos cosas — candidato a borrar o completar.</td></tr>
                </tbody>
              </table>
            </div>

            <div className="mn-note mn-note--warn">
              <span className="mn-note__icon">⚠️</span>
              <p><strong>El costo de un ingrediente se edita solo desde acá.</strong> La pantalla de <span className="mn-ui">Costos</span> no deja tocar el precio de un ingrediente que ya tiene cantidad/precio de compra cargados aquí — es para que esos números nunca queden desincronizados.</p>
            </div>
          </section>

          {/* PARAMETROS */}
          <section className="mn-section" id="parametros">
            <div className="mn-kicker">2 · La estructura del negocio <span className="mn-path">/operational-parameters</span></div>
            <h2 className="mn-h2">Parámetros operativos</h2>
            <p className="mn-dek">Todo lo que no es un ingrediente pero también es costo: sueldos, alquiler, marketing. El sistema convierte esto en una tarifa por hora de trabajo, que cada receta suma según cuántas horas-hombre lleva.</p>

            <h4 className="mn-h4">Capacidad</h4>
            <p className="mn-p">Cargá <span className="mn-ui">Jornadas de trabajo/mes</span>, <span className="mn-ui">Horas promedio/jornada</span> y <span className="mn-ui">Horas-hombre disponibles/mes</span>, y tocá <span className="mn-ui">Guardar capacidad</span>. El tercer campo no se calcula solo de los otros dos — es el número real de capacidad que se usa para repartir costos, lo cargás vos a criterio.</p>

            <h4 className="mn-h4">Mano de obra — socios</h4>
            <ol className="mn-steps">
              <li>Completá <span className="mn-ui">Nombre</span> y <span className="mn-ui">Sueldo/mes</span> en la fila de abajo de la tabla y tocá <span className="mn-ui">+ Agregar</span>.</li>
              <li>El check de <span className="mn-ui">Activo</span> en cada fila decide si ese sueldo entra en la cuenta — desmarcalo si un socio no cobra ese mes, sin borrarlo.</li>
              <li>El ícono de tacho borra al socio de la lista.</li>
            </ol>
            <p className="mn-p">Debajo de la tabla ves el total de sueldos activos y la tarifa de mano de obra por hora, ya calculada.</p>

            <h4 className="mn-h4">Costos fijos mensuales</h4>
            <p className="mn-p">Mismo mecanismo: <span className="mn-ui">Concepto</span> + <span className="mn-ui">Costo/mes</span> + <span className="mn-ui">+ Agregar</span>, con su check de <span className="mn-ui">Activo</span>. Útil para simular: por ejemplo, "Alquiler" puede estar cargado pero inactivo porque hoy no se paga — el día que se empiece a pagar, lo activás y todos los precios se recalculan con esa estructura nueva.</p>

            <h4 className="mn-h4">Comisiones por canal</h4>
            <p className="mn-p">Por cada canal (Minorista, Mayorista, Fábrica, Catering) hay una fila con la comisión actual y un campo para cargar una nueva, con su botón <span className="mn-ui">Guardar</span>. Hoy están en 0% porque no se cobra con Mercado Pago ni tarjeta. El día que eso cambie, cargás el % una sola vez y el precio final de venta de todas las recetas se ajusta solo para que el margen quede neto de esa comisión.</p>

            <div className="mn-note mn-note--tip">
              <span className="mn-note__icon">💡</span>
              <p>Al final de la pantalla, la tarjeta <span className="mn-ui">Estructura mensual</span> resume la tarifa operativa por hora y el total mensual a cubrir — el número detrás de "mano de obra" y "operativo fijo" en el costeo de cada receta.</p>
            </div>
          </section>

          {/* RECETAS */}
          <section className="mn-section" id="recetas">
            <div className="mn-kicker">3 · El corazón del sistema <span className="mn-path">/recipes</span></div>
            <h2 className="mn-h2">Recetas</h2>
            <p className="mn-dek">Elegís un producto en el selector <span className="mn-ui">Producto final</span> de arriba. Aparecen dos columnas —Ingredientes y Calculadora, que ya existían— y debajo, tres secciones nuevas: la ficha de costeo, el resultado calculado y los precios por canal.</p>

            <h4 className="mn-h4">Ingredientes de la receta (columna izquierda)</h4>
            <ol className="mn-steps">
              <li>Tocá <span className="mn-ui">+ Agregar ingrediente</span>.</li>
              <li>Elegís el ingrediente, cuánto lleva (<span className="mn-ui">Cant. ingr.</span>) y para qué tamaño de tanda (<span className="mn-ui">Cant. batch</span>, 100 por defecto).</li>
              <li>Si el ingrediente todavía no existe, el link <span className="mn-ui">+ Crear producto nuevo</span> abre un modal para darlo de alta sin salir de la pantalla.</li>
            </ol>
            <p className="mn-p">La columna derecha (<span className="mn-ui">Calculadora</span>) sirve para el día a día en la cocina: cargás cuánto querés producir y te dice cuánto de cada ingrediente necesitás.</p>

            <h3 className="mn-h3" id="recetas-ficha">Ficha de costeo</h3>
            <p className="mn-p">Debajo de esas dos columnas está la tarjeta <span className="mn-ui">Costeo de receta</span>. Es el formulario que le dice al sistema cómo se produce esta receta — con eso alcanza para calcular el costo, no hace falta tocar ninguna fórmula a mano.</p>

            <div className="mn-tablewrap">
              <table className="mn-table">
                <thead><tr><th>Campo</th><th>Qué cargar</th></tr></thead>
                <tbody>
                  <tr><td>Tipo</td><td><b>Preparación base</b>: se ahúma y se usa DENTRO de otra receta, nunca se vende suelta (ej. Bondiola Ahumada (base) → se convierte en Bondiola Desmenuzada). <b>Producto final</b>: se vende directo.</td></tr>
                  <tr><td>Unidad de venta</td><td>Texto libre: "kg", "unidad", "porción 300 g"… la unidad en la que realmente se vende (las empanadas se venden por empanada, no por docena).</td></tr>
                  <tr><td>Unidades por pack / Nombre del pack</td><td>Solo informativo, para mostrar el precio del pack (ej. "docena").</td></tr>
                  <tr><td>Insumo principal / Kg insumo principal</td><td>El ingrediente que define el rinde y cuántos kg crudos entran a la tanda. Solo para carnes ahumadas — empanadas y figazzas no lo usan.</td></tr>
                  <tr><td>Merma cocción %</td><td>Cuánto peso pierde la carne al ahumarse. No se cobra aparte: ya está adentro del rinde.</td></tr>
                  <tr><td>Kg por unidad de venta</td><td>Cuántos kilos terminados representa una unidad de venta (ej. 1 kg para "envase x1 kg", 0,3 kg para "porción 300 g").</td></tr>
                  <tr><td>Rinde manual</td><td>Si no hay insumo principal (empanadas, figazzas) cargás directamente cuántas unidades salen de la tanda.</td></tr>
                  <tr><td>Desperdicio %</td><td>Roturas o descarte — a diferencia de la merma, esto sí recarga el costo.</td></tr>
                  <tr><td>Horas-hombre / tanda</td><td>Cuánto trabajo lleva una tanda completa.</td></tr>
                  <tr><td>Margen minorista / mayorista / catering %</td><td>El margen que querés ganar en cada canal. <b>Vacío = "no se vende por ese canal"</b>.</td></tr>
                  <tr><td>Activo / Notas</td><td>Desmarcá Activo si la receta se discontinúa. Notas es texto libre.</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mn-p">Completá lo que aplique y tocá <span className="mn-ui">Crear perfil de costeo</span> (la primera vez) o <span className="mn-ui">Guardar cambios</span> (si ya existía).</p>

            <div className="mn-example">
              <div className="mn-example__label">Ejemplo real — Bondiola Ahumada (base)</div>
              <div className="mn-tablewrap">
                <table className="mn-table">
                  <tbody>
                    <tr><td>Insumo principal</td><td className="num">Bondiola de cerdo</td></tr>
                    <tr><td>Kg insumo principal</td><td className="num">28 kg</td></tr>
                    <tr><td>Merma de cocción</td><td className="num">35%</td></tr>
                    <tr><td>Kg por unidad de venta</td><td className="num">1</td></tr>
                    <tr><td>Horas-hombre / tanda</td><td className="num">6</td></tr>
                    <tr><td>Márgenes por canal</td><td className="num">vacíos (es insumo interno)</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <h3 className="mn-h3" id="recetas-resultado">Resultado del costeo</h3>
            <p className="mn-p">Aparece debajo, solo, en cuanto guardás la ficha — nada se toca a mano acá.</p>
            <div className="mn-tablewrap">
              <table className="mn-table">
                <tbody>
                  <tr><td>Materia prima</td><td>Suma de ingredientes × su costo.</td></tr>
                  <tr><td>Con desperdicio</td><td>Materia prima + el % de desperdicio.</td></tr>
                  <tr><td>Mano de obra</td><td>Horas-hombre × tarifa de mano de obra (de Parámetros operativos).</td></tr>
                  <tr><td>Operativo fijo</td><td>Horas-hombre × tarifa de costos fijos.</td></tr>
                  <tr><td>Rinde usado</td><td>Cuántas unidades salen de la tanda.</td></tr>
                  <tr><td><b>Costo por unidad</b></td><td>La suma de todo — alimenta los precios por canal.</td></tr>
                </tbody>
              </table>
            </div>
            <div className="mn-example">
              <div className="mn-example__label">Bondiola Ahumada (base) — resultado</div>
              <div className="mn-tablewrap">
                <table className="mn-table">
                  <tbody>
                    <tr><td>Materia prima</td><td className="num">$18.309</td></tr>
                    <tr><td>Mano de obra</td><td className="num">$549</td></tr>
                    <tr><td>Operativo fijo</td><td className="num">$859</td></tr>
                    <tr className="mn-total"><td>Costo por unidad</td><td className="num">$19.717 / kg</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mn-note mn-note--danger">
              <span className="mn-note__icon">🚩</span>
              <p>Si aparecen alertas en rojo (ingrediente sin costo, ingrediente desactivado, ciclo de subreceta), la receta está calculando con datos incompletos — el mensaje te dice exactamente qué falta.</p>
            </div>

            <h3 className="mn-h3" id="recetas-precios">Precios por canal</h3>
            <p className="mn-p">Debajo del resultado, una tabla con tres números por canal:</p>
            <div className="mn-tablewrap">
              <table className="mn-table">
                <thead><tr><th>Columna</th><th>Qué es</th></tr></thead>
                <tbody>
                  <tr><td>Calculado</td><td>Costo × (1 + margen) ÷ (1 − comisión). El precio "de fórmula".</td></tr>
                  <tr><td>Override</td><td>Un precio real que cargás vos a mano.</td></tr>
                  <tr><td>Final</td><td>El que se usa en el resto del sistema: el override si existe, si no, el calculado.</td></tr>
                </tbody>
              </table>
            </div>
            <ol className="mn-steps">
              <li>Escribí el precio nuevo en el campo junto al canal que querés cambiar.</li>
              <li>Tocá <span className="mn-ui">OK</span>. Ese valor pasa a ser el override, y el "Final" hasta que lo vuelvas a cambiar.</li>
            </ol>
            <div className="mn-example">
              <div className="mn-example__label">Bondiola Desmenuzada — minorista</div>
              <div className="mn-tablewrap">
                <table className="mn-table">
                  <tbody>
                    <tr><td>Calculado</td><td className="num">$32.564</td></tr>
                    <tr><td>Override</td><td className="num">$40.000</td></tr>
                    <tr className="mn-total"><td>Final (el que se usa)</td><td className="num">$40.000</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mn-note mn-note--warn">
              <span className="mn-note__icon">⚠️</span>
              <p>Si un canal dice <b>"no se vende"</b>, el campo queda deshabilitado a propósito: una preparación base como la Bondiola Ahumada no tiene precio de mayorista porque nunca se vende suelta.</p>
            </div>

            <h3 className="mn-h3" id="recetas-rentabilidad">Rentabilidad</h3>
            <p className="mn-p">Al final de la pantalla, la tarjeta <span className="mn-ui">Rentabilidad</span> lista todas las recetas con su costo por unidad y margen por canal, de un vistazo. El botón <span className="mn-ui">Ver</span> de cualquier fila te lleva directo a esa receta, arriba.</p>
          </section>

          {/* PLAN DE PRODUCCIÓN */}
          <section className="mn-section" id="plan">
            <div className="mn-kicker">4 · ¿Nos alcanza este mes? <span className="mn-path">/production-plan</span></div>
            <h2 className="mn-h2">Plan de producción</h2>
            <p className="mn-dek">Cargás cuántas tandas de cada receta pensás hacer en el mes, y el sistema te dice si esa producción cubre sueldos y costos fijos.</p>
            <ol className="mn-steps">
              <li>Elegí el mes en el selector de arriba a la derecha.</li>
              <li>En la tabla <span className="mn-ui">Tandas del mes</span>, escribí las tandas planeadas de cada receta y tocá <span className="mn-ui">Guardar</span> en esa fila.</li>
              <li>El resumen de abajo se recalcula solo con cada cambio.</li>
            </ol>
            <div className="mn-note mn-note--tip">
              <span className="mn-note__icon">💡</span>
              <p>Cargá también las tandas de las preparaciones base (Bondiola Ahumada, Brisket Ahumado, etc.) — si no, el sistema no cuenta las horas de ahumado de ese mes.</p>
            </div>
            <div className="mn-example">
              <div className="mn-example__label">Ejemplo ilustrativo (no son tus datos reales)</div>
              <div className="mn-tablewrap">
                <table className="mn-table">
                  <tbody>
                    <tr><td>Horas-hombre del plan</td><td className="num">112</td></tr>
                    <tr><td>Capacidad disponible/mes</td><td className="num">240</td></tr>
                    <tr><td>% de capacidad usada</td><td className="num">47%</td></tr>
                    <tr><td>Estructura mensual</td><td className="num">$1.025.000</td></tr>
                    <tr><td>Estructura no recuperada</td><td className="num">$547.000</td></tr>
                    <tr><td>Margen de contribución %</td><td className="num">33%</td></tr>
                    <tr className="mn-total"><td>Resultado estimado del mes</td><td className="num">−$260.000</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <p className="mn-p">Al pie, un cartel <b>✅ verde</b> significa que el margen de contribución cubre toda la estructura mensual; <b>🔴 rojo</b>, que no alcanza — hay que producir/vender más, subir precios o bajar costos fijos.</p>
          </section>

          {/* PRESUPUESTOS */}
          <section className="mn-section" id="presupuestos">
            <div className="mn-kicker">5 · Cotizar un evento <span className="mn-path">/quotes</span></div>
            <h2 className="mn-h2">Presupuestos</h2>
            <p className="mn-dek">El cotizador para cuando alguien pide precio para un evento o catering. No genera una orden ni descuenta stock: es solo el número que le mandás al cliente.</p>
            <ol className="mn-steps">
              <li>Tocá <span className="mn-ui">+ Nuevo presupuesto</span>.</li>
              <li>Elegí un <span className="mn-ui">Cliente existente</span> o completá <span className="mn-ui">Nombre del cliente / evento</span> a mano.</li>
              <li>Cargá <span className="mn-ui">Tipo de venta</span> y <span className="mn-ui">Cantidad de personas</span> (define el precio por persona final).</li>
              <li>En <span className="mn-ui">Productos</span>: elegí producto, canal y cantidad, y tocá <span className="mn-ui">+ Agregar</span>. El precio se completa solo con el precio final de ese canal — si querés otro, escribilo en <span className="mn-ui">Precio (opcional)</span> antes de agregar la línea.</li>
              <li>En <span className="mn-ui">Agregados opcionales</span> cargá lo que corresponda: Transporte, Packaging adicional, Personal adicional, Horas extra, Otros cargos, y el <span className="mn-ui">Descuento (%)</span> si hay.</li>
              <li>El <span className="mn-ui">Resumen económico</span> se actualiza en vivo. Tocá <span className="mn-ui">Guardar</span>.</li>
            </ol>
            <div className="mn-example">
              <div className="mn-example__label">Ejemplo real — evento de 35 personas</div>
              <div className="mn-tablewrap">
                <table className="mn-table">
                  <thead><tr><th>Producto</th><th>Canal</th><th className="num">Cant.</th><th className="num">Precio</th><th className="num">Subtotal</th></tr></thead>
                  <tbody>
                    <tr><td>Bondiola Desmenuzada</td><td>Catering</td><td className="num">5 kg</td><td className="num">$30.321</td><td className="num">$151.605</td></tr>
                    <tr><td>Empanadas de Bondiola</td><td>Catering</td><td className="num">35 u</td><td className="num">$2.848</td><td className="num">$99.680</td></tr>
                    <tr><td>Figazzas para Sandwichs</td><td>Catering</td><td className="num">150 u</td><td className="num">$657</td><td className="num">$98.550</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="mn-tablewrap" style={{ marginTop: 12 }}>
                <table className="mn-table">
                  <tbody>
                    <tr><td>Subtotal productos</td><td className="num">$349.835</td></tr>
                    <tr><td>Agregados</td><td className="num">$43.600</td></tr>
                    <tr className="mn-total"><td>Total del presupuesto</td><td className="num">$393.438</td></tr>
                    <tr><td>Precio por persona (35 personas)</td><td className="num">$11.241</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* CANALES */}
          <section className="mn-section" id="canales">
            <div className="mn-kicker">De paso</div>
            <h2 className="mn-h2">Canales de precio y el nuevo "Catering"</h2>
            <p className="mn-dek">Ahora hay cuatro listas de precio en todo el sistema: Minorista, Mayorista, Fábrica y Catering. Este último es nuevo, pensado para Alumo — Fábrica sigue siendo el que usa Hop, no se tocó.</p>
            <p className="mn-p">Vas a ver la columna Catering en <span className="mn-ui">/products</span>, <span className="mn-ui">/prices</span> y en el selector de lista de precio del calculador de órdenes, además de en Recetas y Presupuestos.</p>
          </section>

          {/* GLOSARIO */}
          <section className="mn-section" id="glosario">
            <div className="mn-kicker">Referencia</div>
            <h2 className="mn-h2">Glosario</h2>
            <div className="mn-glossary">
              <div className="mn-gcard"><dt>Rinde</dt><dd>Cuántas unidades de venta salen de una tanda.</dd></div>
              <div className="mn-gcard"><dt>Merma de cocción</dt><dd>Peso que pierde la carne al ahumarse. No se cobra aparte.</dd></div>
              <div className="mn-gcard"><dt>Desperdicio</dt><dd>Roturas o descarte. A diferencia de la merma, sí recarga el costo.</dd></div>
              <div className="mn-gcard"><dt>Tanda</dt><dd>Una producción completa de una receta.</dd></div>
              <div className="mn-gcard"><dt>Insumo principal</dt><dd>El ingrediente que define el rinde de una preparación.</dd></div>
              <div className="mn-gcard"><dt>Subreceta</dt><dd>Una preparación base usada como ingrediente de otra receta.</dd></div>
              <div className="mn-gcard"><dt>Margen</dt><dd>Cuánto querés ganar por encima del costo, por canal.</dd></div>
              <div className="mn-gcard"><dt>Comisión</dt><dd>Lo que se lleva un medio de cobro (Mercado Pago, tarjeta).</dd></div>
              <div className="mn-gcard"><dt>Override</dt><dd>Un precio real cargado a mano, que pisa al calculado.</dd></div>
              <div className="mn-gcard"><dt>Horas-hombre</dt><dd>Horas de trabajo que lleva una tarea.</dd></div>
              <div className="mn-gcard"><dt>Estructura mensual</dt><dd>Sueldos activos + costos fijos activos.</dd></div>
              <div className="mn-gcard"><dt>Margen de contribución</dt><dd>Ingreso menos materia prima — lo que queda para pagar sueldos y costos fijos.</dd></div>
              <div className="mn-gcard"><dt>Punto de equilibrio</dt><dd>Cuánto hay que facturar para cubrir la estructura mensual exacta.</dd></div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
