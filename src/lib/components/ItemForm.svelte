<script lang="ts">
	import { ITEM_SLOTS, SLOT_LABELS, type ItemBonus } from '#lib/economy.ts';

	/** Campi di un oggetto del catalogo (creazione e modifica nel pannello). */
	type Values = {
		name: string;
		description: string;
		category: string;
		slot: string;
		price: number;
		forSale: boolean;
		stock: number | null;
		shopId?: number | null;
		sellable: boolean;
		consumable: boolean;
		bonuses: ItemBonus[];
		imageUrl?: string | null;
	};

	let {
		values,
		errors = {},
		stats,
		skills,
		categories = [],
		shops = []
	}: {
		values: Values;
		errors?: Record<string, string>;
		stats: { id: number; name: string }[];
		skills: { id: number; name: string }[];
		categories?: string[];
		shops?: { id: number; name: string; isOpen: boolean }[];
	} = $props();

	// Bonus esistenti più due righe vuote (al massimo 6).
	const rows = $derived([
		...values.bonuses.map((b) => ({ target: b.statId ? `stat:${b.statId}` : `skill:${b.skillId}`, value: b.value })),
		...Array.from({ length: Math.max(0, Math.min(2, 6 - values.bonuses.length)) }, () => ({ target: '', value: 0 }))
	]);
</script>

<div>
	<label for="name">Nome</label>
	<input id="name" name="name" type="text" maxlength="60" required value={values.name} />
	{#if errors.name}<p class="field-error">{errors.name}</p>{/if}
</div>
<div>
	<label for="shopId">Negozio <span class="hint">dove si compra al mercato</span></label>
	<select id="shopId" name="shopId" value={values.shopId ?? ''}>
		<option value="">— Nessuno (Altri articoli) —</option>
		{#each shops as s (s.id)}<option value={s.id}>{s.name}{s.isOpen ? '' : ' (chiuso)'}</option>{/each}
	</select>
</div>
<div class="two">
	<div>
		<label for="category">Categoria <span class="hint">raggruppa il mercato</span></label>
		<input id="category" name="category" type="text" maxlength="40" value={values.category} list="item-categories" placeholder="Es. Armi, Abiti, Medicinali" />
		<datalist id="item-categories">{#each categories as c (c)}<option value={c}></option>{/each}</datalist>
	</div>
	<div>
		<label for="slot">Si indossa su</label>
		<select id="slot" name="slot" value={values.slot}>
			{#each ITEM_SLOTS as s (s)}<option value={s}>{SLOT_LABELS[s]}</option>{/each}
		</select>
	</div>
</div>
<div>
	<label for="description">Descrizione <span class="hint">ciò che si vede in gioco: aspetto, materiali, dettagli</span></label>
	<textarea id="description" name="description" rows="4" maxlength="3000">{values.description}</textarea>
	{#if errors.description}<p class="field-error">{errors.description}</p>{/if}
</div>
<div>
	<label for="image">{values.imageUrl ? 'Sostituisci immagine' : 'Immagine'} <span class="hint">facoltativa</span></label>
	<input id="image" name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
	{#if errors.image}<p class="field-error">{errors.image}</p>{/if}
</div>
<div class="two">
	<div>
		<label for="price">Prezzo</label>
		<input id="price" name="price" type="number" min="0" value={values.price} />
		{#if errors.price}<p class="field-error">{errors.price}</p>{/if}
	</div>
	<div>
		<label for="stock">Pezzi al mercato <span class="hint">vuoto = illimitati</span></label>
		<input id="stock" name="stock" type="number" min="0" value={values.stock ?? ''} />
		{#if errors.stock}<p class="field-error">{errors.stock}</p>{/if}
	</div>
</div>
<div class="checks">
	<label class="checkbox"><input type="checkbox" name="forSale" checked={values.forSale} /><span>In vendita al mercato</span></label>
	<label class="checkbox"><input type="checkbox" name="sellable" checked={values.sellable} /><span>Si può rivendere</span></label>
	<label class="checkbox"><input type="checkbox" name="consumable" checked={values.consumable} /><span>Si consuma usandolo</span></label>
</div>

<fieldset class="bonuses">
	<legend>Bonus nelle quest <span class="hint">solo se indossato; anche negativi (malus)</span></legend>
	{#each rows as r, i (i)}
		<div class="bonus-row">
			<select name="bonusTarget" value={r.target} aria-label="Bonus {i + 1}: caratteristica o abilità">
				<option value="">—</option>
				<optgroup label="Caratteristiche">
					{#each stats as s (s.id)}<option value="stat:{s.id}">{s.name}</option>{/each}
				</optgroup>
				<optgroup label="Abilità">
					{#each skills as s (s.id)}<option value="skill:{s.id}">{s.name}</option>{/each}
				</optgroup>
			</select>
			<input name="bonusValue" type="number" min="-50" max="50" value={r.value || ''} aria-label="Valore del bonus {i + 1}" />
		</div>
	{/each}
	{#if errors.bonuses}<p class="field-error">{errors.bonuses}</p>{/if}
	<p class="hint">Si sommano al tiro delle prove sulla caratteristica o abilità scelta (e sulle abilità legate a quella caratteristica).</p>
</fieldset>

<style>
	.two {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
		gap: 0.75rem;
	}
	.checks {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.5rem;
	}
	.bonuses {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.75rem 1rem;
		margin: 0;
		display: grid;
		gap: 0.5rem;
	}
	.bonuses legend {
		padding: 0 0.4rem;
		font-weight: 600;
	}
	.bonus-row {
		display: flex;
		gap: 0.5rem;
	}
	.bonus-row select {
		flex: 1;
		width: auto;
		min-width: 0;
	}
	.bonus-row input {
		width: 6rem;
	}
	.bonuses .hint {
		margin: 0;
	}
</style>
