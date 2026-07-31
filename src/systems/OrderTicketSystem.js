import { CONFIG, COLORS } from '../config.js';
import { roundRect } from '../ui/canvas/drawUtils.js';
const CONVEYOR = { startX: 420, endX: 620, yCenter: 330 };

let _nextId = 1;

export class OrderTicketSystem {
  constructor() {
    /** @type {Array<{
     *  id: number,
     *  customerName: string,
     *  speciesLabel: string,
     *  recipe: object,
     *  x: number,
     *  y: number,
     *  progress: number,
     *  ready: boolean,
     *  served: boolean,
     *  customer: object|null,
     * }>} */
    this.tickets = [];
  }

  /**
   * @param {import('../entities/Customer.js').Customer} customer
   */
  createTicket(customer) {
    const ticket = {
      id: _nextId++,
      customerName: customer.name,
      speciesLabel: customer.species.label,
      recipe: customer.order,
      x: CONVEYOR.startX,
      y: CONVEYOR.yCenter - 14,
      progress: 0,
      ready: false,
      served: false,
      customer,
    };
    customer.ticketId = ticket.id;
    this.tickets.push(ticket);
    return ticket;
  }

  update(dt) {
    for (const t of this.tickets) {
      if (t.served) continue;
      if (!t.ready) {
        t.x += CONFIG.TICKET_SPEED * dt;
        if (t.x >= CONVEYOR.endX - 40) {
          t.x = CONVEYOR.endX - 40;
          t.ready = true;
        }
      }
    }
  }

  /**
   * Serve the oldest ready ticket (Phase 1 auto-match).
   * @returns {object|null}
   */
  serveReady() {
    const t = this.tickets.find((x) => x.ready && !x.served);
    if (!t) return null;
    t.served = true;
    return t;
  }

  /** Drop tickets for a customer who left unserved */
  cancelFor(customer) {
    this.tickets = this.tickets.filter((ticket) => ticket.customer !== customer);
  }

  hitTest(mx, my) {
    for (const t of this.tickets) {
      if (t.served) continue;
      if (mx >= t.x && mx <= t.x + 70 && my >= t.y && my <= t.y + 28) return t;
    }
    return null;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    for (const t of this.tickets) {
      if (t.served) continue;
      // Paper slip
      ctx.fillStyle = '#fff8e7';
      ctx.strokeStyle = t.ready ? COLORS.mint : '#c4a882';
      ctx.lineWidth = t.ready ? 3 : 1.5;
      roundRect(ctx, t.x, t.y, 70, 28, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = COLORS.ink;
      ctx.font = 'bold 10px Fredoka, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(t.customerName, t.x + 6, t.y + 12);
      ctx.font = '11px serif';
      ctx.fillText(`${t.recipe.emoji} ${t.recipe.name}`, t.x + 6, t.y + 23);

      if (t.ready) {
        ctx.fillStyle = COLORS.mint;
        ctx.font = 'bold 9px Fredoka, sans-serif';
        ctx.fillText('ORDER', t.x + 38, t.y - 2);
      }
    }

    // Cleanup served after draw cycle retention
    this.tickets = this.tickets.filter((t) => !t.served);
  }
}
