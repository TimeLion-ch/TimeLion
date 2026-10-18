<?php

declare(strict_types=1);

$finder = (new PhpCsFixer\Finder())
	->in([__DIR__ . '/bin', __DIR__ . '/dev', __DIR__ . '/public', __DIR__ . '/src', __DIR__ . '/tests'])
	->append([__DIR__ . '/config.example.php', __FILE__]);

return (new PhpCsFixer\Config())
	->setRiskyAllowed(true)
	->setIndent("\t")
	->setLineEnding("\n")
	->setCacheFile(__DIR__ . '/var/cache/php-cs-fixer.cache')
	->setFinder($finder)
	->setRules([
		'@PER-CS' => true,
		'@PHP8x3Migration' => true,
		'declare_strict_types' => true,
		'global_namespace_import' => ['import_classes' => true, 'import_constants' => false, 'import_functions' => false],
		'no_unused_imports' => true,
		'ordered_imports' => ['imports_order' => ['class', 'function', 'const'], 'sort_algorithm' => 'alpha'],
		'single_quote' => true,
		'strict_comparison' => true,
		'strict_param' => true,
	]);
