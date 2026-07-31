/**
 * Serving / delivery helpers extracted from Game to keep the orchestrator thinner.
 * Methods are bound with game context: createServeApi(game).
 */

/**
 * @param {import('../engine/Game.js').Game} game
 */
export function createServeApi(game) {
  return {
    serveFromCase(recipeId) {
      const customer =
        game.spawner.customers
          .filter(
            (c) =>
              c.state === 'waiting' &&
              c.ordered &&
              !c.served &&
              c.order?.id === recipeId &&
              !game.foodConveyor.hasTrayFor(c),
          )
          .sort((a, b) => (b.waitTimer || 0) - (a.waitTimer || 0))[0] ||
        game.spawner.findWaitingForFood();

      if (!customer) {
        game.hud.toast('Nobody is waiting at a table right now.');
        game.audio.playSfx('sad');
        return;
      }
      if (customer.order?.id !== recipeId) {
        game.hud.toast(
          `${customer.name} wants ${customer.order.emoji} — pick that from the case.`,
        );
        game.audio.playSfx('sad');
        return;
      }
      if (game.foodConveyor.hasTrayFor(customer)) {
        game.hud.toast('Food is already on the way!');
        return;
      }
      if (!game.pastryStock.has(recipeId)) {
        game.hud.toast('That treat is gone from the case.');
        return;
      }
      const take = game.pastryStock.take(recipeId);
      if (!take.ok) return;
      const plate = {
        recipe: customer.order,
        ingredients: [...customer.order.ingredients],
      };
      game._sendToConveyor(plate, customer);
      game.hud.casePickerOpen = false;
      game.hud.toast(`Sent ${plate.recipe.emoji} to ${customer.seat?.label || 'their table'}!`);
      game.audio.playSfx('confirm');
      game.persist();
    },

    tryServeFromCounter() {
      const customer = game.spawner.findWaitingForFood();
      if (!customer) {
        game.hud.toast('No customer waiting — or open the pastry case to pick a treat.');
        return;
      }
      if (game.foodConveyor.hasTrayFor(customer)) {
        game.hud.toast('Food is already on the way to their table!');
        return;
      }

      let plate = null;
      if (game.player.heldPlate && game.player.heldPlate.recipe?.id === customer.order.id) {
        plate = game.player.heldPlate;
        game.player.clearHeld();
        game.cooking.clearPlated();
      } else if (game.pastryStock.has(customer.order.id)) {
        const take = game.pastryStock.take(customer.order.id);
        if (take.ok) {
          plate = {
            recipe: customer.order,
            ingredients: [...customer.order.ingredients],
          };
          game.persist();
        }
      }

      if (!plate) {
        game.hud.toast(
          `Need ${customer.order.emoji} in the case — bake it, carry to case, then serve!`,
        );
        game.audio.playSfx('sad');
        return;
      }

      game._sendToConveyor(plate, customer);
      game.hud.toast(`Sent ${plate.recipe.emoji} to ${customer.seat?.label || 'their table'}!`);
      game.audio.playSfx('confirm');
    },
  };
}
