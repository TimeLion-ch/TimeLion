<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class HomeController extends AbstractController
{
	#[Route('/', name: 'home')]
	public function index(): Response
	{
		return $this->render('home/index.html.twig');
	}

	#[Route('/lang/{language}', name: 'set_language')]
	public function language($language, Request $request): Response
	{
		$request->getSession()->set('_locale', $language);
		return $this->redirectToRoute('home');
	}
}