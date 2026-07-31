import { CONFIG, ASSET_MANIFEST, daySettings } from '../config.js';
import { getUpgrade } from '../data/upgrades.js';
import { Input } from './Input.js';
import { Display } from './Display.js';
import { AssetLoader } from './AssetLoader.js';
import { AudioManager } from './AudioManager.js';
import { IsoCamera } from './IsoCamera.js';
import { SaveManager } from './SaveManager.js';
import { PATISSERIE, collisionRects, fixtureDefinitions, decorDefinitions } from '../world/RestaurantLayout.js';
import { IsoRenderer } from '../world/IsoRenderer.js';
import { isoToWorld } from '../world/IsoMath.js';
import { Player } from '../entities/Player.js';
import { InteractionSystem } from '../systems/InteractionSystem.js';
import { CustomerSpawner } from '../systems/CustomerSpawner.js';
import { OrderTicketSystem } from '../systems/OrderTicketSystem.js';
import { CookingSystem } from '../systems/CookingSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { EconomySystem } from '../systems/EconomySystem.js';
import { StaffSystem } from '../systems/StaffSystem.js';
import { ConversationSystem } from '../systems/ConversationSystem.js';
import { StockSystem } from '../systems/StockSystem.js';
import { SeatingSystem } from '../systems/SeatingSystem.js';
import { FoodConveyorSystem, CONVEYOR_PATH } from '../systems/FoodConveyorSystem.js';
import { createServeApi } from '../systems/ServeFlow.js';
import { HUD } from '../ui/HUD.js';
import { ProfileCard } from '../ui/ProfileCard.js';
import { StudyBook } from '../ui/StudyBook.js';
import { ShopUI } from '../ui/ShopUI.js';
import { getIngredient } from '../data/ingredients.js';
import { getRecipe, recipeIngredientLabels } from '../data/recipes.js';
import { DIFFICULTY_PRESETS } from '../data/difficulty.js';
import { displayOrderText, fillDialogueDisplay, pickDialogue } from '../data/dialogue.js';

export class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
      colorSpace: 'srgb',
    }) || canvas.getContext('2d');
    this.display = new Display(canvas);
    this.input = new Input(canvas);
    this.assets = new AssetLoader();
    this.audio = new AudioManager(ASSET_MANIFEST.audio);
    this.camera = new IsoCamera();
    this.renderer = new IsoRenderer();
    this.layout = { ...PATISSERIE, fixtures: [...PATISSERIE.fixtures] };
    this.walls = collisionRects();
    this.level = {
      interactables: this.layout.fixtures,
      getCollisionRects: () => this.walls,
      update: (dt) => this.renderer.update(dt),
    };
    this.save = new SaveManager();
    this.saved = this.save.load();
    this.hud = new HUD();
    this.profile = new ProfileCard();
    this.book = new StudyBook();
    this.shop = new ShopUI();
    this.interact = new InteractionSystem();
    this.tickets = new OrderTicketSystem();
    this.cooking = new CookingSystem();
    this.inventory = new InventorySystem(this.saved?.inventory);
    this.pastryStock = new StockSystem(this.saved?.pastryStock);
    this.economy = new EconomySystem(this.saved?.economy);
    this._refreshLayout();
    this.seating = new SeatingSystem(this.economy);
    this.foodConveyor = new FoodConveyorSystem();
    this.staff = new StaffSystem(this.economy);
    this.conversation = new ConversationSystem();
    this.serveApi = createServeApi(this);
    /** @type {Player|null} */
    this.player = null;
    /** @type {CustomerSpawner|null} */
    this.spawner = null;

    this.difficulty = this.saved?.difficulty ?? 'cozy';
    this.settings = DIFFICULTY_PRESETS[this.difficulty];
    this.day = this.saved?.day ?? 1;
    this.money = this.economy.money;
    if (!this.saved) {
      this.money = this.settings.startingMoney;
      this.economy.money = this.money;
    }
    this.stars = 0;
    this.phase = 'PREP';
    this.dayTimeLeft = this.saved?.dayTimeLeft ?? this.settings.dayLength;
    this.overviewTimer = 0;
    this.paused = false;
    this.time = 0;
    this.running = false;
    this._last = 0;
    this._acc = 0;
    this.STEP = 1 / 60;
    /** @type {import('../entities/Customer.js').Customer|null} */
    this.activeCustomer = null;
    this.cleanBonusGiven = false;
    this.happyServesToday = 0;
    this.offerEarlyClose = false;
    this._autosaveTimer = 0;
    this.debugMoney = true; // playtest free-$ button (remove later)
    /** @type {import('../entities/Customer.js').Customer[]} */
    this._greetingQueue = [];
    /** Chat deferred until greet/order voice finishes. */
    this._pendingChatCustomer = null;
    /** Customer whose greet→order voice sequence is in progress. */
    this._voiceGreetingCustomer = null;
    /** @type {string|null} recipe id pinned from the study book */
    this.pinnedRecipeId = this.saved?.pinnedRecipeId ?? null;
    this.bathroomDirty = new Set(['toilet1', 'toilet2']);
    this.restroomOccupancy = new Map();
    this.talkTarget = null;
    window.addEventListener('beforeunload', () => this.persist());
  }

  async init() {
    this.display.attach();
    await this.assets.loadImages(ASSET_MANIFEST.images);
    this.renderer.setAssets(this.assets);
    this.player = new Player({
      assets: this.assets,
      x: this.layout.waypoints.playerStart.x,
      y: this.layout.waypoints.playerStart.y,
    });
    if (this.saved?.controlMode) this.player.setControlMode(this.saved.controlMode);
    if (this.saved?.cooking) this.cooking.restore(this.saved.cooking);
    this._refreshLayout();
    if (this.saved?.heldPlate?.recipeId) {
      this.player.holdPlate({
        recipe: getRecipe(this.saved.heldPlate.recipeId),
        ingredients: [...(this.saved.heldPlate.ingredients || [])],
      });
    }
    if (Array.isArray(this.saved?.dirtyDishes)) {
      this.player.dirtyDishes = this.saved.dirtyDishes.slice(0, this.player.dishCarryMax);
    }
    if (Array.isArray(this.saved?.tableDishes)) {
      this.seating.dirty = this.saved.tableDishes.filter(
        (dish) => dish && Number.isFinite(dish.x) && Number.isFinite(dish.y),
      );
    }
    if (Array.isArray(this.saved?.bathroomDirty)) {
      this.bathroomDirty = new Set(this.saved.bathroomDirty);
    }
    this._syncBearLook();
    this.spawner = new CustomerSpawner(this.assets);
    this.spawner.setDay(this.day);
    this.spawner.setDifficulty(this.settings);
    this.camera.setOverview();
    this._bindEarlyAudioUnlock();
    this.running = true;
    this._last = performance.now();
    if (this.saved) {
      const interrupted = this.saved.phase === 'SERVICE' || this.saved.phase === 'CLOSING';
      this.hud.toast(
        interrupted
          ? `Welcome back! Day ${this.day} · $${this.money} — prep resumed after refresh.`
          : `Welcome back! Day ${this.day} · $${this.money} saved.`,
      );
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  /**
   * Unlock audio on the first pointer/key gesture (title or prep).
   * Idempotent — AudioManager ignores repeats while unlocked / unlocking.
   */
  _tryUnlockAudio() {
    if (this.audio.unlocked || this.audio._unlocking) return;
    this.audio.unlock().then((ok) => {
      if (ok) this.audio.playMusic();
    });
  }

  _bindEarlyAudioUnlock() {
    const once = () => this._tryUnlockAudio();
    window.addEventListener('pointerdown', once, { passive: true });
    window.addEventListener('keydown', once, { passive: true });
  }

  _syncBearLook() {
    if (this.player) this.player.spriteOverride = this.economy.bearSpriteKey();
  }

  /** Sync fixtures, collision, decor, and oven slots with owned upgrades. */
  _refreshLayout() {
    const secondOven = this.economy.has('secondOven');
    this.layout.fixtures = fixtureDefinitions({ secondOven });
    this.layout.decor = decorDefinitions({
      extraCouch: this.economy.has('extraCouch'),
      extraChairs: this.economy.has('extraChairs'),
    });
    this.level.interactables = this.layout.fixtures;
    this.walls = collisionRects(this.economy.extraTables, { secondOven });
    this.cooking.ensureOvens(secondOven);
  }

  /**
   * Play a voice clip. Subtitle prefers manifest text (exact spoken words),
   * then falls back to the customer's bound dialogue lines.
   * @param {import('../entities/Customer.js').Customer} customer
   * @param {'greet'|'order'|'chat'} bucket
   * @param {{ onEnded?: () => void, interrupt?: boolean }} [opts]
   */
  _playCustomerVoice(customer, bucket, opts = {}) {
    if (!customer) return null;
    const recipeId = bucket === 'order' ? customer.order?.id : null;
    this.audio.playVoice(customer.species.id, bucket, recipeId, opts);
    const spoken =
      this.audio.voiceText(customer.species.id, bucket, recipeId) ||
      (bucket === 'greet'
        ? customer.greetLine
        : bucket === 'order'
          ? customer.orderLine
          : customer.chatLine);
    // Keep the bound customer line in sync with whatever we just spoke.
    if (spoken) {
      if (bucket === 'greet') customer.greetLine = spoken;
      else if (bucket === 'order') customer.orderLine = spoken;
      else if (bucket === 'chat') customer.chatLine = spoken;
    }
    return spoken || null;
  }

  _cueOrderVoice(customer) {
    if (!customer) return;
    if (this._voiceGreetingCustomer !== customer) return;
    if (this.profile.orderCued) return;
    this.profile.markOrderCued();
    const text = this._playCustomerVoice(customer, 'order', {
      onEnded: () => {
        if (this._voiceGreetingCustomer === customer) this._voiceGreetingCustomer = null;
        this._flushPendingChat();
        this._drainGreetingQueue();
      },
    });
    if (text) this.hud.toast(`${customer.name}: ${text}`);
  }

  _flushPendingChat() {
    const customer = this._pendingChatCustomer;
    this._pendingChatCustomer = null;
    if (!customer || customer.state === 'done' || customer.state === 'leaving') return;
    this._talkToCustomer(customer, { forceVoice: true });
  }

  _showGreeting(customer) {
    this.activeCustomer = customer;
    customer.state = 'greeting';
    this._voiceGreetingCustomer = customer;
    const greetText = this._playCustomerVoice(customer, 'greet', {
      onEnded: () => this._cueOrderVoice(customer),
    });
    this.profile.show(customer);
    // Short glance at the guest, then the camera returns to the player.
    this.camera.focus(customer, 1.2, 1.2);
    this.audio.playSfx('bell');
    this.hud.setGuide(
      `${customer.name} wants ${displayOrderText(customer.order)} — serve from the case or bake it!`,
    );
    this.hud.toast(`${customer.name}: ${greetText || customer.greetLine}`);
    // No audio (muted / not loaded): still advance to the order line promptly.
    if (!this.audio.isVoicePlaying) {
      this._cueOrderVoice(customer);
    }
  }

  /** Start next queued greeting only when profile is free and voice is idle. */
  _drainGreetingQueue() {
    if (this.profile.active) return;
    if (this.audio.isVoicePlaying) return;
    const next = this._greetingQueue.shift();
    if (!next || next.state === 'done' || next.state === 'leaving') return;
    if (next.state !== 'greeting' && next.state !== 'queue') return;
    this._showGreeting(next);
  }

  loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this._acc += dt;
    while (this._acc >= this.STEP) {
      this.update(this.STEP);
      this._acc -= this.STEP;
    }
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  worldMouse() {
    return isoToWorld(this.input.mouse.x, this.input.mouse.y, this.camera);
  }

  persist() {
    this.save.save(this._savePayload());
  }

  giveDebugMoney(amount = 100) {
    this.money += amount;
    this.economy.money = this.money;
    this.hud.toast(`Playtest +$${amount} (debug)`);
    this.audio.playSfx('happy');
    this.persist();
  }

  putBackActiveBowl() {
    const res = this.cooking.putBack(this.inventory, this.cooking.activeBowlId);
    if (res.ok) {
      this.hud.toast(`Put back ${res.returned.length} item(s) from ${res.bowl?.label || 'bowl'}.`);
      this.audio.playSfx('drop');
      this.persist();
    } else {
      this.hud.toast('Nothing to put back in this bowl.');
    }
  }

  openRestaurant() {
    if (this.phase !== 'PREP') {
      this.hud.toast('Already open or closing!');
      return;
    }
    this.phase = 'SERVICE';
    this.dayTimeLeft = this.settings.dayLength;
    this.spawner.setEnabled(true);
    this.spawner.timer = 2;
    this.camera.follow(this.player, 1.1);
    this.hud.toast('We’re OPEN! Customers will arrive soon.');
    this.hud.setGuide('Greet guests, seat them, serve from the pastry case!');
    this.audio.playSfx('bell');
  }

  update(dt) {
    this.hud.update(dt);
    this.shop.update(dt);

    if (this.hud.showTitle) {
      this.camera.setOverview();
      this.camera.update(dt, null);
      for (const [key, id] of [['1', 'cozy'], ['2', 'balanced'], ['3', 'busy']]) {
        if (!this.input.justPressed(key)) continue;
        this.difficulty = id;
        this.settings = DIFFICULTY_PRESETS[id];
        // Keep saved money — difficulty only changes pace, not your wallet
        this.dayTimeLeft = this.settings.dayLength;
        this.spawner?.setDifficulty(this.settings);
        const blurbs = {
          cozy: 'Cozy — 1 friend at a time, lots of thinking time',
          balanced: 'Balanced — a few friends may visit together',
          busy: 'Busy — quicker orders and shorter waiting time',
        };
        this.hud.toast(blurbs[id] || `${this.settings.name} selected.`);
        this.persist();
      }
      if (this.input.mouse.leftClick || this.input.justPressed('enter')) {
        this.hud.dismissTitle();
        this.phase = this.saved?.phase === 'SERVICE' ? 'PREP' : 'PREP';
        this.overviewTimer = CONFIG.OVERVIEW_SECONDS;
        this.camera.setOverview();
        this.spawner.setEnabled(false);
        this.hud.toast('Prep time! Bake treats, carry them to the case, then OPEN.');
        this.audio.unlock().then((ok) => {
          if (ok) {
            this.audio.playMusic();
            this.audio.playSfx('confirm');
          }
        });
        this.persist();
      }
      this.input.endFrame();
      return;
    }

    if (this.book.open) {
      if (this.input.mouse.leftClick) {
        const action = this.book.click(this.input.mouse.x, this.input.mouse.y);
        if (action?.type === 'pin_recipe') {
          this.pinnedRecipeId = action.recipeId;
          this.hud.toast(`Pinned ${getRecipe(action.recipeId)?.name || 'recipe'} to the side`);
          this.persist();
        }
        this.audio.playSfx('click');
      }
      this.book.handleInput(this.input);
      this.input.endFrame();
      return;
    }

    if (this.conversation.active) {
      if (this.input.mouse.leftClick || this.input.justPressed('e') || this.input.justPressed('escape')) {
        this.conversation.close();
      }
      this.input.endFrame();
      return;
    }

    if (this.shop.open) {
      if (this.input.justPressed('o') || this.input.justPressed('escape')) this.shop.hide();
      if (this.input.mouse.leftClick) {
        const result = this.shop.click(
          this.input.mouse.x,
          this.input.mouse.y,
          this.economy,
          this.inventory,
          this.pastryStock,
        );
        if (result?.type === 'bought') {
          if (result.result.ok) {
            this.money = this.economy.money;
            this._refreshLayout();
            this._syncBearLook();
            this.hud.toast(`Purchased ${result.upgrade.name}!`);
            this.audio.playSfx('happy');
            this.persist();
          } else {
            this.hud.toast(result.result.reason === 'money' ? 'Not enough money yet.' : 'Already owned.');
            this.audio.playSfx('sad');
          }
        } else if (result?.type === 'toggle') {
          this._syncBearLook();
          this.hud.toast(`Look updated: ${this.economy.bearSpriteKey()}`);
          this.persist();
          this.audio.playSfx('confirm');
        } else if (result?.type === 'confirm') {
          this.audio.playSfx('click');
        }
      }
      this.input.endFrame();
      return;
    }

    if (this.input.justPressed('b')) {
      this.book.toggle();
      this.audio.playSfx('confirm');
      this.hud.toast(this.book.open ? 'Study Book open!' : 'Book closed');
      this.input.endFrame();
      return;
    }
    if (this.input.justPressed('o')) {
      this.shop.show();
      this.input.endFrame();
      return;
    }
    if (this.input.justPressed('p') || this.input.justPressed('escape')) {
      if (this.hud.casePickerOpen) {
        this.hud.casePickerOpen = false;
        this.audio.playSfx('click');
      } else {
        this.paused = !this.paused;
        this.audio.playSfx('click');
      }
    }
    if (this.paused) {
      if (this.input.mouse.leftClick) {
        const menuHit = this.hud.menuHitTest(this.input.mouse.x, this.input.mouse.y);
        if (menuHit) this._handleMenuAction(menuHit);
      }
      this.input.endFrame();
      return;
    }
    if (this.input.justPressed('m')) {
      const muted = this.audio.toggleMute();
      this.hud.toast(muted ? 'Music muted' : 'Music on');
    }
    if (this.input.justPressed('n')) {
      this.audio.nextSong();
      this.hud.toast('Next chill track');
    }
    if (this.input.justPressed('r') && !this.hud.showTitle) {
      this.putBackActiveBowl();
    }
    if (this.debugMoney && (this.input.justPressed('=') || this.input.justPressed('+'))) {
      this.giveDebugMoney(100);
    }
    if (this.phase === 'PREP' && this.overviewTimer <= 0 && this.input.justPressed('enter')) {
      this.openRestaurant();
    }
    if (
      this.phase === 'SERVICE' &&
      this.offerEarlyClose &&
      this.input.justPressed('enter')
    ) {
      this.phase = 'CLOSING';
      this.spawner.setEnabled(false);
      this.offerEarlyClose = false;
      this.hud.toast('Closing early — clean up, then a new day!');
      this.audio.playSfx('confirm');
    }

    if (this.paused) {
      this.input.endFrame();
      return;
    }

    this.time += dt;
    this.level.update(dt);
    this.cooking.update(dt);

    // Brief bakery overview at start of prep (skippable)
    if (this.phase === 'PREP' && this.overviewTimer > 0) {
      this.overviewTimer -= dt;
      this.camera.setOverview();
      this.camera.update(dt, null);
      this.hud.setGuide('Here’s the bakery! Click or press Enter to start prep…');
      if (
        this.overviewTimer <= 0 ||
        this.input.mouse.leftClick ||
        this.input.justPressed('enter') ||
        this.input.justPressed(' ')
      ) {
        this.overviewTimer = 0;
        this.camera.follow(this.player, 1.1);
        this.hud.setGuide(
          this.day === 1
            ? 'Day 1 PREP: bake a Cookie into the case, then Open (Enter)!'
            : 'PREP: bake into the case, then press Enter or use the Open sign!',
        );
      }
      this.input.endFrame();
      return;
    }

    if (this.phase === 'SERVICE') {
      this.dayTimeLeft -= dt;
      if (this.dayTimeLeft <= 0) {
        this.phase = 'CLOSING';
        this.spawner.setEnabled(false);
        this.hud.toast('Closing time — pick up dishes and run them through the dishwasher!');
      }
    }

    // Greeting card is non-blocking: it advances on its own while the player
    // keeps moving, cooking, and talking. Order voice is chained from greet
    // onEnded — the card timer only dismisses the UI.
    if (this.profile.active) {
      const greetingCustomer = this.profile.customer;
      const clickedCard =
        this.input.mouse.leftClick &&
        this.profile.hitTest(this.input.mouse.x, this.input.mouse.y);
      const result = clickedCard ? this.profile.dismiss() : this.profile.update(dt);

      if (clickedCard) {
        this.audio.playSfx('click');
        this._cardClickConsumed = true;
      }
      if (result === 'done' && greetingCustomer) {
        this.finishGreeting(greetingCustomer);
        this._drainGreetingQueue();
      }
    } else if (!this.audio.isVoicePlaying) {
      this._drainGreetingQueue();
    }

    if (this.cooking.anyOvenBaking()) {
      const baking = this.cooking.ovens.find((o) => o.state === 'baking');
      const fixture = this.level.interactables.find((f) => f.id === baking?.id);
      if (fixture) {
        this.camera.focus(
          { x: fixture.x + fixture.w / 2, y: fixture.y + fixture.h / 2 },
          1.12,
          0.5,
        );
      }
    } else {
      this.camera.follow(this.player, 1.1);
    }
    this.camera.update(dt, this.player);

    const walls = this.level.getCollisionRects();
    const screenMouse = { ...this.input.mouse };
    // Rebuild HUD zones first so follow doesn't chase the cursor over UI.
    this.hud.rebuildHitZones({
      cooking: this.cooking,
      pastryStock: this.pastryStock,
      debugMode: this.debugMoney,
      pinnedRecipe: this.pinnedRecipeId ? getRecipe(this.pinnedRecipeId) : null,
      activeOrder: this.spawner?.findWaitingForFood()?.order || null,
    });
    const overHud =
      this.hud.hitTest(screenMouse.x, screenMouse.y) ||
      screenMouse.y < 52 ||
      screenMouse.y > 500 ||
      (screenMouse.x > 660 && screenMouse.y < 340);
    this.input.uiBlocksFollow = !!overHud;

    const world = this.worldMouse();
    this.input.mouse.x = world.x;
    this.input.mouse.y = world.y;
    this.player.update(dt, this.input, walls);
    this.input.mouse.x = screenMouse.x;
    this.input.mouse.y = screenMouse.y;

    if (this.input.mouse.leftClick) {
      const hudHit = this.hud.hitTest(screenMouse.x, screenMouse.y);
      if (hudHit) {
        this._handleHudClick(hudHit);
        this._skipWorldClick = true;
      } else {
        this._skipWorldClick = !!this._cardClickConsumed;
      }
    } else {
      this._skipWorldClick = false;
    }
    this._cardClickConsumed = false;

    const nearest = this.interact.update(this.player, this.level.interactables);
    this.talkTarget = this.nearestCustomer(94);

    if (this.input.mouse.leftClick && !this._skipWorldClick) {
      this._tryUnlockAudio();
      if (this.hud.casePickerOpen) {
        // clicks handled via hud hitTest above
      } else {
        // Tap / click = same as E (grab, talk, bake). Never walk-to-click.
        this._doPrimaryAction();
      }
    }

    if (this.input.justPressed('e') && !this.hud.casePickerOpen) {
      this._doPrimaryAction();
    }

    this.spawner.setDay(this.day);
    this.spawner.update(dt, walls, {
      dirtyPlateCount: () => this.seating.dirtyCount(),
      onMessAnnoyed: (customer) => {
        this.hud.toast(`${customer.name}: Too many dirty plates — clean up!`);
        this.audio.playSfx('sad');
      },
      onReachedPickup: (customer) => this._finishPickup(customer),
      onReadyToOrder: (customer) => {
        if (this.profile.active) {
          if (!this._greetingQueue.includes(customer)) this._greetingQueue.push(customer);
          return;
        }
        this._showGreeting(customer);
      },
      onFinishedEating: (customer) => {
        this.seating.release(customer, true);
        this._seatNextWaiting();
      },
      onRequestRestroom: (customer) => this._requestRestroom(customer),
      onRestroomDone: (customer) => this._finishRestroomVisit(customer),
      onLeave: (customer, happy) => {
        if (customer.seat) this.seating.release(customer, customer.served);
        this.tickets.cancelFor(customer);
        this.foodConveyor.trays = this.foodConveyor.trays.filter((t) => t.customer !== customer);
        if (customer._pendingPlate?.recipe?.id) {
          this.pastryStock.add(customer._pendingPlate.recipe.id, 1);
          customer._pendingPlate = null;
        }
        if (!happy) {
          this.audio.playSfx('sad');
          this.hud.toast(`${customer.name} left hungry…`);
        }
        if (this.activeCustomer === customer) this.activeCustomer = null;
        this._seatNextWaiting();
      },
    });

    this.tickets.update(dt);

    for (const tray of this.foodConveyor.update(dt)) {
      this._deliverTray(tray);
    }

    const waitingForFood = this.spawner.findWaitingForFood();
    const serveBlocked = waitingForFood && this.foodConveyor.hasTrayFor(waitingForFood);
    for (const event of this.staff.update(dt, this.inventory, this.cooking, waitingForFood, {
      phase: this.phase,
      seating: this.seating,
      bathroomDirty: this.bathroomDirty,
      pastryStock: this.pastryStock,
      serveBlocked,
    })) {
      if (event.type === 'stocked') {
        const ingredient = getIngredient(event.ingredientId);
        this.hud.toast(`Squirrel refilled ${ingredient?.name ?? 'a bowl'}.`);
        this.persist();
      } else if (event.type === 'dishCollected') {
        this.hud.toast(`Bunny cleared ${event.label}.`);
      } else if (event.type === 'dishesWashed') {
        this.hud.toast(
          `Bunny washed ${event.count} dish${event.count === 1 ? '' : 'es'}.`,
        );
        this.persist();
      } else if (event.type === 'serve') {
        const customer = event.customer;
        if (
          customer &&
          customer.state === 'waiting' &&
          !customer.served &&
          !this.foodConveyor.hasTrayFor(customer) &&
          event.recipeId &&
          this.pastryStock.has(event.recipeId)
        ) {
          const take = this.pastryStock.take(event.recipeId);
          if (take.ok) {
            const plate = {
              recipe: customer.order,
              ingredients: [...customer.order.ingredients],
            };
            this._sendToConveyor(plate, customer);
            this.hud.toast(`Bunny served ${plate.recipe.emoji} to ${customer.name}!`);
            this.audio.playSfx('confirm');
            this.persist();
          }
        }
      } else if (event.type === 'bathroomCleaned') {
        this.hud.toast('Frog scrubbed a restroom stall.');
      }
    }

    this._updateGuide();
    this._autosaveTimer = (this._autosaveTimer || 0) + dt;
    if (this._autosaveTimer >= 12) {
      this._autosaveTimer = 0;
      this.persist();
    }

    if (
      this.phase === 'CLOSING' &&
      this.spawner.activeCount() === 0 &&
      this.cooking.anyOvenBaking() === false &&
      this.foodConveyor.trays.length === 0
    ) {
      if (this.player.heldPlate || this.cooking.plated) {
        const plate = this.player.heldPlate || this.cooking.plated;
        let stocked = this.pastryStock.add(plate.recipe.id, 1);
        if (!stocked.ok) {
          this.pastryStock.increaseCapacity(2);
          stocked = this.pastryStock.add(plate.recipe.id, 1);
        }
        this.cooking.clearPlated();
        this.player.clearHeld();
        this.persist();
      }
      const dishesRemaining =
        this.seating.dirtyCount() + this.player.dirtyDishes.length;
      const bathsDirty = this.bathroomDirty.size;
      if (dishesRemaining > 0) {
        this.hud.setGuide(
          this.player.dirtyDishes.length
            ? `Carry ${this.player.dirtyDishes.length} dish(es) to the kitchen DISHWASHER!`
            : `Pick up ${this.seating.dirtyCount()} dirty dish(es) from the tables.`,
        );
      } else if (bathsDirty > 0) {
        this.hud.setGuide(
          `Scrub the restroom — ${bathsDirty} stall${bathsDirty === 1 ? '' : 's'} still dirty!`,
        );
      } else {
        if (!this.cleanBonusGiven) {
          this.cleanBonusGiven = true;
          const tip = 3 + this.economy.ambience;
          this.money += tip;
          this.economy.money = this.money;
          this.hud.toast(`Spotless close! +$${tip} tidy bonus`);
          this.persist();
        }
        this._startNewDay();
      }
    }

    this.input.endFrame();
  }

  customerAt(x, y) {
    return this.spawner.customers.find(
      (customer) =>
        customer.state !== 'done' &&
        Math.hypot(customer.cx - x, customer.cy - y) < Math.max(32, customer.size),
    );
  }

  nearestCustomer(range = 94) {
    let best = null;
    let bestDistance = range;
    for (const customer of this.spawner?.customers || []) {
      if (customer.state === 'done' || customer.state === 'leaving') continue;
      const distance = Math.hypot(this.player.cx - customer.cx, this.player.cy - customer.cy);
      if (distance < bestDistance) {
        best = customer;
        bestDistance = distance;
      }
    }
    return best;
  }

  _talkToCustomer(customer, { forceVoice = false } = {}) {
    const dialogue = this.conversation.open(customer, {
      ambience: this.economy.ambience,
      tables: this.seating.tables().length,
    });
    const greetingBusy =
      this._voiceGreetingCustomer === customer ||
      (this.profile.active && this.profile.customer === customer);
    if (greetingBusy && !forceVoice) {
      // Show the same chat transcript we'll speak after greet/order finishes.
      const pending =
        this.audio.voiceText(customer.species.id, 'chat') || customer.chatLine;
      dialogue.text = `${customer.name}: ${pending}`;
      this._pendingChatCustomer = customer;
      this.camera.focus(customer, 1.2, 3);
      return;
    }
    const voiceText = this._playCustomerVoice(customer, 'chat', { interrupt: forceVoice || !greetingBusy });
    if (voiceText) dialogue.text = `${customer.name}: ${voiceText}`;
    this.camera.focus(customer, 1.2, 3);
  }

  _talkToSelf() {
    // Bear only chats with customers — no self-talk.
  }

  /**
   * Shared action for E and tap/click: talk, use nearest station, or bus dishes.
   * Never walks the bear and never triggers self-talk.
   */
  _doPrimaryAction() {
    const nearest = this.interact.nearest ||
      this.interact.update(this.player, this.level.interactables);
    this.talkTarget = this.nearestCustomer(94);
    const stationDistance = nearest
      ? Math.hypot(
          this.player.cx - (nearest.x + nearest.w / 2),
          this.player.cy - (nearest.y + nearest.h / 2),
        )
      : Infinity;
    const talkDistance = this.talkTarget
      ? Math.hypot(this.player.cx - this.talkTarget.cx, this.player.cy - this.talkTarget.cy)
      : Infinity;

    if (this.phase === 'CLOSING') {
      if (
        this.player.dirtyDishes.length >= this.player.dishCarryMax &&
        this.seating.dirtyCount()
      ) {
        this.hud.toast('Dish stack full — take it to the kitchen DISHWASHER!');
        return;
      }
      if (this._pickupNearestDirtyDish(90)) return;
      if (nearest) {
        this.useInteractable(nearest);
        return;
      }
      return;
    }

    if (this.talkTarget && (!nearest || talkDistance + 12 < stationDistance)) {
      this._talkToCustomer(this.talkTarget);
    } else if (nearest) {
      this.useInteractable(nearest);
    } else if (this.talkTarget) {
      this._talkToCustomer(this.talkTarget);
    } else {
      this._pickupNearestDirtyDish(56);
    }
  }

  _deliverTray(tray) {
    const { plate, customer } = tray;
    if (!customer || customer.served || customer.state === 'done' || customer.state === 'leaving') {
      if (plate?.recipe?.id) this.pastryStock.add(plate.recipe.id, 1);
      return;
    }
    // Guest walks to the pickup window to collect the tray.
    customer._pendingPlate = plate;
    const pickup = this.layout.waypoints.pickup || CONVEYOR_PATH.pickup;
    customer.walkToPickup(pickup);
    this.hud.toast(`${customer.name} is walking over to pick up their treat!`);
    this.camera.focus({ x: pickup.x, y: pickup.y }, 1.15, 2);
  }

  _finishPickup(customer) {
    const plate = customer._pendingPlate;
    customer._pendingPlate = null;
    if (!plate || customer.served) {
      if (customer.seat) {
        customer.state = 'waiting';
        customer.target = { x: customer.seat.x, y: customer.seat.y };
      }
      return;
    }
    const verdict = this.cooking.judgeServe(plate, customer);
    this._applyServeVerdict(customer, plate, verdict);
  }

  _applyServeVerdict(customer, plate, verdict) {
    if (verdict.good) {
      customer.receiveFood(true, 'happy');
      const tip = this.economy.tipBonus(plate.recipe.price);
      const earned = plate.recipe.price + tip;
      this.money += earned;
      this.economy.money = this.money;
      this.happyServesToday += 1;
      this.persist();
      this.audio.playSfx('happy');
      const tipText = tip ? ` (+$${tip} tip)` : '';
      this.hud.toast(
        `${customer.name}: ${fillDialogueDisplay(pickDialogue(customer.species.id, 'thanks'), {
          name: customer.name,
          order: plate.recipe,
        })} +$${earned}${tipText}`,
      );
      this.stars = Math.min(5, Math.floor(this.money / 20));
      this.camera.focus(customer, 1.22, 3);
      if (this.day === 1 && this.happyServesToday === 1 && this.phase === 'SERVICE') {
        this.offerEarlyClose = true;
        this.hud.toast('Great first customer! Press Enter to close early and clean up →');
      }
    } else if (verdict.emote === 'spit') {
      customer.receiveFood(false, 'spit');
      this.audio.playSfx('sad');
      this.hud.toast(
        `${customer.name}: ${fillDialogueDisplay(pickDialogue(customer.species.id, 'dislikeReact'), {
          name: customer.name,
          order: customer.order,
        })}`,
      );
    } else {
      customer.receiveFood(false, 'sad');
      this.audio.playSfx('sad');
      this.hud.toast(`${customer.name} looks disappointed…`);
    }
  }

  _requestRestroom(customer) {
    const nameScore = [...customer.name].reduce((sum, char) => sum + char.charCodeAt(0), this.day);
    if (nameScore % 3 !== 0) return null;
    const station = this.layout.restroomStations.find(
      (candidate) => !this.restroomOccupancy.has(candidate.id),
    );
    if (!station) return null;
    this.restroomOccupancy.set(station.id, customer);
    customer.restroomStationId = station.id;
    this.hud.toast(`${customer.name} is taking a quick restroom break, then washing hands.`);
    return [
      { x: 590, y: 195 },
      { ...this.layout.waypoints.restroomEntry },
      { ...this.layout.waypoints.restroomAisle },
      { x: 785, y: station.toilet.y },
      { ...station.toilet, action: 'toilet', duration: 2.4 },
      { x: 785, y: station.toilet.y },
      { ...this.layout.waypoints.restroomAisle },
      { ...station.sink, action: 'sink', duration: 2 },
      { x: station.sink.x, y: this.layout.waypoints.restroomAisle.y },
      { ...this.layout.waypoints.restroomEntry, action: 'done' },
    ];
  }

  _finishRestroomVisit(customer) {
    if (customer.restroomStationId) {
      this.restroomOccupancy.delete(customer.restroomStationId);
      customer.restroomStationId = null;
    }
    this.hud.toast(`${customer.name} washed their hands and is heading home!`);
  }

  finishGreeting(customer) {
    const seat = this.seating.assign(customer);
    this.audio.playSfx('confirm');
    if (seat) {
      customer.placeOrder(seat);
      this.tickets.createTicket(customer);
      this.hud.toast(`${customer.name} — please take ${seat.label}!`);
      this.hud.setGuide(
        `Serve ${customer.order.emoji} ${customer.order.name} from stock (or bake) → Serving Counter`,
      );
      this.camera.focus({ x: seat.x, y: seat.y }, 1.2, 2.5);
    } else {
      customer.waitForSeat();
      this.hud.toast('No free tables — hang tight by the register!');
      this.hud.setGuide('Buy tables in the Back Office (O), or wait for a free seat.');
      this.camera.focus(customer, 1.2, 2);
    }
    this.activeCustomer = customer;
  }

  _seatNextWaiting() {
    const guest = this.spawner.findWaitingForSeat();
    if (!guest) return;
    const seat = this.seating.assign(guest);
    if (!seat) return;
    guest.placeOrder(seat);
    this.tickets.createTicket(guest);
    this.hud.toast(`${guest.name} — a seat opened at ${seat.label}!`);
    this.audio.playSfx('bell');
  }

  _handleMenuAction(hit) {
    if (!hit) return;
    if (hit.type === 'menu_continue') {
      this.paused = false;
      this.audio.playSfx('click');
      return;
    }
    if (hit.type === 'menu_save') {
      this.persist();
      this.hud.toast('Game saved!');
      this.audio.playSfx('confirm');
      return;
    }
    if (hit.type === 'menu_download_save') {
      this.persist();
      this.save.download(this._savePayload());
      this.hud.toast('Save file downloaded!');
      this.audio.playSfx('confirm');
      return;
    }
    if (hit.type === 'menu_load_save') {
      this.save.promptUpload((data) => {
        if (!data) {
          this.hud.toast('Could not read that save file.');
          return;
        }
        this.save.save(data);
        this.hud.toast('Save loaded — refresh the page to apply.');
        this.audio.playSfx('confirm');
        window.location.reload();
      });
      return;
    }
    if (hit.type === 'menu_skip_day') {
      this.paused = false;
      this._skipToNextDay();
      return;
    }
    if (hit.type === 'menu_mute') {
      const muted = this.audio.toggleMute();
      this.hud.toast(muted ? 'Music muted' : 'Music on');
      return;
    }
    if (hit.type === 'menu_controls') {
      const mode = hit.payload === 'classic' ? 'classic' : 'follow';
      this.player?.setControlMode(mode);
      this.persist();
      this.hud.toast(
        mode === 'classic'
          ? 'Classic controls: WASD + click + E'
          : 'Mouse follow: bear tracks the pointer',
      );
      this.audio.playSfx('confirm');
      return;
    }
    if (hit.type === 'menu_difficulty') {
      this.difficulty = hit.payload;
      this.settings = DIFFICULTY_PRESETS[this.difficulty];
      this.spawner?.setDifficulty(this.settings);
      this.hud.toast(`Difficulty: ${this.settings.name || this.difficulty} (applies next day)`);
      this.persist();
      this.audio.playSfx('confirm');
    }
  }

  _savePayload() {
    this.economy.money = this.money;
    return {
      day: this.day,
      difficulty: this.difficulty,
      phase: this.phase,
      dayTimeLeft: this.dayTimeLeft,
      inventory: this.inventory.serialize(),
      pastryStock: this.pastryStock.serialize(),
      economy: this.economy.serialize(),
      cooking: this.cooking.serialize(),
      heldPlate: this.player?.heldPlate
        ? {
            recipeId: this.player.heldPlate.recipe.id,
            ingredients: [...this.player.heldPlate.ingredients],
          }
        : null,
      dirtyDishes: [...(this.player?.dirtyDishes || [])],
      tableDishes: [...(this.seating?.dirty || [])],
      bathroomDirty: [...(this.bathroomDirty || [])],
      pinnedRecipeId: this.pinnedRecipeId,
      controlMode: this.player?.controlMode || 'follow',
      savedAt: Date.now(),
    };
  }

  /** End the current day and jump straight into the next prep. */
  _skipToNextDay() {
    this.phase = 'CLOSING';
    this.spawner?.setEnabled(false);
    this.profile.dismiss();
    this._greetingQueue = [];
    this._voiceGreetingCustomer = null;
    this.hud.toast('Skipping to next day…');
    this.audio.playSfx('confirm');
    this._startNewDay();
  }

  _handleHudClick(hit) {
    if (hit.type === 'free_money') {
      this.giveDebugMoney(100);
      return;
    }
    if (hit.type === 'unpin_recipe') {
      this.pinnedRecipeId = null;
      this.persist();
      this.hud.toast('Recipe unpinned');
      this.audio.playSfx('click');
      return;
    }
    if (hit.type === 'put_back') {
      this.putBackActiveBowl();
      return;
    }
    if (hit.type === 'select_bowl') {
      this.cooking.setActiveBowl(hit.payload);
      this.hud.toast(`Using ${this.cooking.getBowl(hit.payload)?.label || 'bowl'}`);
      this.audio.playSfx('click');
      return;
    }
    if (hit.type === 'case_close') {
      this.hud.casePickerOpen = false;
      this.audio.playSfx('click');
      return;
    }
    if (hit.type === 'case_serve') {
      this.serveApi.serveFromCase(hit.payload);
    }
  }

  useInteractable(item) {
    switch (item.action) {
      case 'add_ingredient': {
        const id = item.ingredientId;
        const ing = getIngredient(id);
        const stock = this.inventory.take(id);
        if (!stock.ok) {
          this.hud.toast(`${ing?.name ?? item.label} is out — use the Pantry shelf!`);
          this.audio.playSfx('sad');
          break;
        }
        const res = this.cooking.addIngredient(id, undefined, {
          targetRecipe: this.spawner.findWaitingForFood()?.order || null,
          inventory: this.inventory,
        });
        if (!res.ok) {
          this.inventory.refill(id, 1);
          if (res.reason === 'already') {
            this.hud.toast(`Already in ${res.bowl?.label || 'bowl'} — try another bowl or Put Back`);
          } else if (res.reason === 'dough_waiting') {
            this.hud.toast(`${res.bowl?.label || 'Bowl'} has dough — bake it or Put Back`);
          } else if (res.reason === 'no_bowl') {
            this.hud.toast('All bowls busy — Put Back (R) or bake dough first!');
          } else {
            this.hud.toast('Bowl is full — Put Back (R) to clear!');
          }
          this.audio.playSfx('sad');
        } else if (res.sealed) {
          this.hud.toast(
            `${res.sealed.emoji} ${res.sealed.name} dough ready in ${res.bowl.label}!`,
          );
          this.audio.playSfx('happy');
          this.persist();
        } else {
          this.hud.toast(`Added ${ing?.emoji} ${ing?.name} → ${res.bowl.label}`);
          this.audio.playSfx('drop');
          this.persist();
        }
        break;
      }
      case 'mix_bowl': {
        const bowlId = item.bowlId || item.id;
        this.cooking.setActiveBowl(bowlId);
        const bowl = this.cooking.getBowl(bowlId);
        if (bowl?.hasDough) {
          this.hud.toast(`${bowl.dough.recipe.emoji} dough ready — take it to the Oven!`);
          break;
        }
        const waiting = this.spawner.findWaitingForFood();
        const target = waiting?.order || null;
        const res = this.cooking.combine(bowlId, target, this.inventory);
        if (res.ok) {
          const extras = res.extras?.length
            ? ` Spare ${res.extras.length} went back to the pantry.`
            : '';
          this.hud.toast(`Combined ${res.recipe.emoji} ${res.recipe.name}! Bake it.${extras}`);
          this.audio.playSfx('confirm');
          this.persist();
        } else if (res.reason === 'incomplete') {
          const miss = (res.missing || []).map((id) => getIngredient(id)?.name || id).join(', ');
          this.hud.toast(`Need more: ${miss} (or press R to Put Back)`);
          this.audio.playSfx('sad');
        } else if (res.reason === 'empty') {
          this.hud.toast('Bowl is empty — scoop ingredients first!');
        } else {
          this.hud.toast("That mix isn't a recipe — press R to Put Back.");
          this.audio.playSfx('sad');
        }
        break;
      }
      case 'bake': {
        const ovenId = item.id === 'oven2' ? 'oven2' : 'oven';
        const oven = this.cooking.getOven(ovenId);
        if (oven.state === 'done') {
          if (this.player.heldPlate) {
            // Auto-stock held plate if case has room so oven can't softlock
            const held = this.player.heldPlate;
            const stocked = this.pastryStock.add(held.recipe.id, 1);
            if (stocked.ok) {
              this.player.clearHeld();
              this.cooking.clearPlated();
              this.hud.toast(`Auto-stocked ${held.recipe.emoji} so you can take the oven!`);
              this.persist();
            } else {
              this.hud.toast('Hands full & case full — serve someone first!');
              this.audio.playSfx('sad');
              break;
            }
          }
          const plate = this.cooking.takeFromOven(ovenId);
          if (plate) {
            this.player.holdPlate(plate);
            this.cooking.clearPlated();
            this.hud.toast(`Got ${plate.recipe.emoji} ${plate.recipe.name}! Carry it to the CASE.`);
            this.audio.playSfx('happy');
            this.persist();
          }
          break;
        }
        if (oven.state === 'baking') {
          this.hud.toast(`Still baking… ${Math.ceil(oven.bakeTimer)}s left`);
          break;
        }
        const res = this.cooking.startBake(this.cooking.activeBowlId, ovenId);
        if (res.ok) {
          const fast = getUpgrade('fastOven');
          if (this.economy.has('fastOven') && fast?.amount) {
            const mult = 1 - fast.amount;
            oven.bakeTimer *= mult;
            oven.bakeTotal = oven.bakeTimer;
          }
          this.hud.toast(
            `Baking ${res.recipe.emoji} ${res.recipe.name} for ${Math.ceil(oven.bakeTimer)}s…`,
          );
          this.audio.playSfx('drop');
          this.persist();
        } else if (res.reason === 'take_first') {
          this.hud.toast('Take the finished treat out of the oven first!');
          this.audio.playSfx('sad');
        } else {
          this.hud.toast('Need dough first — fill a mixing bowl until it says READY!');
          this.audio.playSfx('sad');
        }
        break;
      }
      case 'serve': {
        this.serveApi.tryServeFromCounter();
        break;
      }
      case 'stock_display': {
        if (this.player.heldPlate) {
          const plate = this.player.heldPlate;
          const stocked = this.pastryStock.add(plate.recipe.id, 1);
          if (stocked.ok) {
            this.player.clearHeld();
            this.cooking.clearPlated();
            this.hud.toast(
              `Stocked ${plate.recipe.emoji} ${plate.recipe.name}! Case ${this.pastryStock.total()}/${this.pastryStock.capacity}`,
            );
            this.audio.playSfx('happy');
            this.persist();
          } else {
            this.hud.toast('Case full — serve someone or buy a bigger case!');
            this.audio.playSfx('sad');
          }
          break;
        }
        this.hud.casePickerOpen = true;
        this.hud.toast('Pick a treat from the case to send to a table!');
        this.audio.playSfx('confirm');
        break;
      }
      case 'open_restaurant':
        this.openRestaurant();
        break;
      case 'open_or_order':
        if (this.phase === 'PREP') this.openRestaurant();
        else this.hud.toast('Customers introduce themselves when they arrive!');
        break;
      case 'take_order':
        this.hud.toast('Customers introduce themselves when they arrive!');
        break;
      case 'bank':
        this.hud.toast(this.money > 0 ? `Safe holds your $${this.money}!` : 'Earn tips by serving happy customers.');
        break;
      case 'open_shop':
        this.shop.show();
        this.audio.playSfx('confirm');
        break;
      case 'restock':
        this.inventory.refillAll();
        this.hud.toast('Pantry replenished every ingredient bowl.');
        this.persist();
        break;
      case 'open_book':
      case 'prizes':
        this.book.open = true;
        this.book.page = 0;
        this.hud.toast('Study Book — recipes, bios & friends!');
        break;
      case 'fridge':
        this.hud.toast('Fridge is stocked — use the ingredient jars!');
        break;
      case 'wash_dishes': {
        const count = this.player.washDirtyDishes();
        if (count) {
          this.hud.toast(`Dishwasher cleaned ${count} dish${count === 1 ? '' : 'es'}!`);
          this.audio.playSfx('happy');
          this.persist();
        } else {
          this.hud.toast('Pick up dirty dishes at the café tables first.');
        }
        break;
      }
      case 'clean_sink':
        this.hud.toast('Restroom sink polished and sparkling!');
        this.audio.playSfx('drop');
        break;
      case 'clean_toilet': {
        if (this.bathroomDirty.delete(item.id)) {
          this.hud.toast(`${item.label} scrubbed clean!`);
          this.audio.playSfx('happy');
        } else {
          this.hud.toast(`${item.label} is already sparkling.`);
        }
        break;
      }
      default:
        break;
    }
  }

  _sendToConveyor(plate, customer) {
    this.foodConveyor.enqueue(plate, customer);
    const t = this.tickets.tickets.find((x) => x.customer === customer);
    if (t) t.served = true;
  }

  _pickupDirtyPlate(plate) {
    if (this.player.dirtyDishes.length >= this.player.dishCarryMax) {
      this.hud.toast('Dish stack full — take it to the kitchen DISHWASHER!');
      this.audio.playSfx('sad');
      return false;
    }
    const taken = this.seating.take(plate);
    if (!taken || !this.player.carryDirtyDish(taken)) return false;
    this.hud.toast(
      `Picked up dish from ${plate.label} (${this.player.dirtyDishes.length}/${this.player.dishCarryMax})`,
    );
    this.audio.playSfx('drop');
    return true;
  }

  _pickupNearestDirtyDish(range) {
    if (this.player.dirtyDishes.length >= this.player.dishCarryMax) {
      if (this.seating.dirtyCount()) {
        this.hud.toast('Dish stack full — take it to the kitchen DISHWASHER!');
      }
      return false;
    }
    const plate = this.seating.takeNear(this.player.cx, this.player.cy, range);
    if (!plate) return false;
    if (!this.player.carryDirtyDish(plate)) {
      this.seating.returnDish(plate);
      return false;
    }
    this.hud.toast(
      `Picked up dish from ${plate.label} (${this.player.dirtyDishes.length}/${this.player.dishCarryMax})`,
    );
    this.audio.playSfx('drop');
    return true;
  }

  _updateGuide() {
    if (this.profile.active) return;
    if (this.player?.dirtyDishes.length) {
      this.hud.setGuide(
        `Carrying ${this.player.dirtyDishes.length} dirty dish(es) — take them to the kitchen DISHWASHER!`,
      );
      return;
    }
    if (this.player?.heldPlate) {
      this.hud.setGuide(
        `Carrying ${this.player.heldPlate.recipe.emoji} — walk to the Pastry Case and press E!`,
      );
      return;
    }
    if (this.phase === 'PREP') {
      if (this.cooking.ovenState === 'baking') {
        this.hud.setGuide(`Baking… ${Math.ceil(this.cooking.bakeTimer)}s`);
      } else if (this.cooking.ovenState === 'done') {
        this.hud.setGuide('Oven done! Press E on oven, then carry to the CASE.');
      } else if (this.cooking.hasDoughReady) {
        this.hud.setGuide('Dough READY — put it in the Oven!');
      } else {
        this.hud.setGuide(
          `PREP — Scoop into bowls (auto-dough), bake, carry to case (${this.pastryStock.total()}/${this.pastryStock.capacity}), Open!`,
        );
      }
      return;
    }

    const waiting = this.spawner.findWaitingForFood();
    if (this.cooking.ovenState === 'baking') {
      this.hud.setGuide(`Baking… ${Math.ceil(this.cooking.bakeTimer)}s left.`);
      return;
    }
    if (this.cooking.ovenState === 'done') {
      this.hud.setGuide('Oven DONE — E to take, then carry to the pastry case!');
      return;
    }
    if (waiting) {
      const have = this.pastryStock.has(waiting.order.id);
      this.hud.setGuide(
        have
          ? `${waiting.name} wants ${waiting.order.emoji} — open the CASE or Serving Counter!`
          : `Bake ${waiting.order.emoji} ${waiting.order.name} for ${waiting.name}, then stock the case.`,
      );
      return;
    }
    if (this.phase === 'CLOSING') {
      this.hud.setGuide(
        this.seating.dirtyCount()
          ? `Closing — pick up ${this.seating.dirtyCount()} dish(es), then use the kitchen dishwasher.`
          : 'Closing — wrapping up the day…',
      );
      return;
    }
    this.hud.setGuide('Customers will arrive soon. Chat with them anytime!');
  }

  _startNewDay() {
    this.day += 1;
    this.dayTimeLeft = this.settings.dayLength;
    this.phase = 'PREP';
    this.overviewTimer = 2.5;
    this.cleanBonusGiven = false;
    this.happyServesToday = 0;
    this.offerEarlyClose = false;
    this._greetingQueue = [];
    this.bathroomDirty = new Set(['toilet1', 'toilet2']);
    this.restroomOccupancy.clear();
    // Refund bowl leftovers before refill so stock doesn't dupe
    this.cooking.putBackAll(this.inventory);
    this.cooking.resetKitchen();
    this.player?.clearHeld();
    this.spawner.setDay(this.day);
    this.spawner.setDifficulty(this.settings);
    this.spawner.setEnabled(false);
    this.camera.setOverview();
    const settings = daySettings(this.day);
    this.hud.toast(`Day ${this.day} prep! Stock the case, then open. (Up to ${settings.maxCustomers} guests)`);
    this.audio.playSfx('confirm');
    this.audio.nextSong();
    this.inventory.refillAll();
    this.persist();
  }

  render() {
    const ctx = this.ctx;
    this.display.beginFrame(ctx);
    ctx.clearRect(0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);
    const waiting = this.spawner?.findWaitingForFood();
    const nearest = this.interact?.nearest || null;
    const world = this.hud.showTitle ? null : this.worldMouse();
    const hover = world
      ? this.interact.hitTest(world.x, world.y, this.level.interactables)
      : null;
    this.renderer.draw(
      ctx,
      this.camera,
      this.inventory,
      this.cooking,
      this.economy,
      [...this.spawner.customers, this.player].filter(Boolean),
      this.tickets,
      {
        foodTrays: this.foodConveyor.trays,
        dirtyPlates: this.seating.dirty,
        pastryStock: this.pastryStock,
        assets: this.assets,
        highlightId: nearest?.id || null,
        hoverId: hover?.id || null,
        helpers: this.staff.activeHelpers(),
        phase: this.phase,
        fixtures: this.layout.fixtures,
        decor: this.layout.decor || PATISSERIE.decor,
      },
    );

    this.hud.draw(ctx, {
      day: this.day,
      money: this.money,
      stars: this.stars,
      muted: this.audio.muted,
      mouseFollow: this.player?.mouseFollow,
      controlMode: this.player?.controlMode || 'follow',
      paused: this.paused,
      dayTimeLeft: this.dayTimeLeft,
      phase: this.phase,
      cooking: this.cooking,
      // Show side order once the guest has ordered (card may still be visible).
      activeOrder: waiting?.order || null,
      activeCustomerName: waiting?.name || null,
      pinnedRecipe: this.pinnedRecipeId ? getRecipe(this.pinnedRecipeId) : null,
      difficulty: this.difficulty,
      nextHint: this.hud.guide,
      inventory: this.inventory,
      economy: this.economy,
      pastryStock: this.pastryStock,
      shopOpen: this.shop.open,
      conversation: this.conversation.active,
      heldPlate: this.player?.heldPlate || null,
      dirtyDishCount: this.player?.dirtyDishes.length || 0,
      dishCarryMax: this.player?.dishCarryMax || 4,
      tableDishCount: this.seating.dirtyCount(),
      debugMode: this.debugMoney,
      seatCount: this.seating.seats().length,
      helpers: this.staff.activeHelpers(),
      talkTarget: this.talkTarget,
    });

    this.profile.draw(ctx, this.assets);
    this.book.draw(ctx, this.assets);
    this.drawConversation(ctx);
    this.shop.draw(ctx, this.economy);
  }

  drawConversation(ctx) {
    const dialogue = this.conversation.active;
    if (!dialogue) return;
    ctx.fillStyle = 'rgba(25,18,14,.45)';
    ctx.fillRect(0, 0, 960, 640);
    ctx.fillStyle = '#fff8e7';
    ctx.fillRect(170, 430, 620, 110);
    ctx.strokeStyle = '#c8935b';
    ctx.lineWidth = 3;
    ctx.strokeRect(170, 430, 620, 110);
    ctx.fillStyle = '#2b2118';
    ctx.font = 'bold 18px Fredoka, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(dialogue.customer.name, 195, 462);
    ctx.font = '16px Fredoka, sans-serif';
    this.wrapText(ctx, dialogue.text, 565).forEach((line, i) => ctx.fillText(line, 195, 490 + i * 20));
    ctx.fillStyle = '#6a4a28';
    ctx.font = '12px Fredoka, sans-serif';
    ctx.fillText('Tap or E to continue', 195, 525);
  }

  wrapText(ctx, text, width) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > width && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }
}
